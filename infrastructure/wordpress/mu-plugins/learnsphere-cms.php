<?php
/**
 * Plugin Name: LearnSphere CMS
 * Description: Course/module/lesson/instructor content model, WPGraphQL fields and signed webhooks for the LearnSphere API.
 * Editing: fields are plain post meta - use the "Custom Fields" panel. List fields are one item per line;
 * resources / social links are "Title|https://url" per line.
 */

function ls_meta($id, $key) { return get_post_meta($id, $key, true); }
function ls_lines($id, $key) {
  $v = trim((string) ls_meta($id, $key));
  return $v === '' ? [] : array_values(array_filter(array_map('trim', explode("\n", $v))));
}
function ls_links($id, $key) {
  return array_map(function ($l) {
    $p = array_map('trim', explode('|', $l, 2));
    return ['title' => $p[0], 'url' => $p[1] ?? ''];
  }, ls_lines($id, $key));
}

add_action('init', function () {
  foreach (['course' => 'courses', 'module' => 'modules', 'lesson' => 'lessons', 'instructor' => 'instructors'] as $one => $many) {
    register_post_type($one, [
      'label' => ucfirst($many), 'public' => true, 'show_in_rest' => true, 'has_archive' => false,
      'supports' => ['title', 'editor', 'custom-fields'], 'show_in_graphql' => true,
      'graphql_single_name' => $one, 'graphql_plural_name' => $many, 'menu_icon' => 'dashicons-welcome-learn-more',
    ]);
  }
});

add_action('graphql_register_types', function () {
  $load = function ($id, $ctx) { return $id ? $ctx->get_loader('post')->load_deferred((int) $id) : null; };
  $str = ['type' => 'String'];
  $int = ['type' => 'Int'];
  $strs = ['type' => ['list_of' => 'String']];
  $links = ['type' => ['list_of' => 'LsLink']];

  register_graphql_object_type('LsLink', ['fields' => ['title' => $str, 'url' => $str]]);
  register_graphql_object_type('LsImageNode', ['fields' => ['sourceUrl' => $str]]);
  register_graphql_object_type('LsImage', ['fields' => ['node' => ['type' => 'LsImageNode']]]);

  register_graphql_object_type('LsCourseFields', ['fields' => [
    'shortDescription' => $str, 'description' => $str, 'duration' => $int, 'difficulty' => $str, 'category' => $str,
    'tags' => $strs, 'featured' => ['type' => 'Boolean'], 'seoTitle' => $str, 'seoDescription' => $str,
    'targetAudience' => $str, 'learningObjectives' => $strs, 'prerequisites' => $strs,
    'featuredImage' => ['type' => 'LsImage'], 'instructor' => ['type' => 'Instructor'],
  ]]);
  register_graphql_field('Course', 'courseFields', ['type' => 'LsCourseFields', 'resolve' => function ($post, $args, $ctx) use ($load) {
    $id = $post->databaseId;
    return [
      'shortDescription' => ls_meta($id, 'short_description'), 'description' => ls_meta($id, 'description'),
      'duration' => (int) ls_meta($id, 'duration'), 'difficulty' => ls_meta($id, 'difficulty'), 'category' => ls_meta($id, 'category'),
      'tags' => ls_lines($id, 'tags'), 'featured' => (bool) ls_meta($id, 'featured'), 'seoTitle' => ls_meta($id, 'seo_title'),
      'seoDescription' => ls_meta($id, 'seo_description'), 'targetAudience' => ls_meta($id, 'target_audience'),
      'learningObjectives' => ls_lines($id, 'learning_objectives'), 'prerequisites' => ls_lines($id, 'prerequisites'),
      'featuredImage' => null, 'instructor' => $load(ls_meta($id, 'instructor_id'), $ctx),
    ];
  }]);

  $children = function ($type, $parentKey) use ($load) {
    return function ($post, $args, $ctx) use ($type, $parentKey, $load) {
      $ids = get_posts(['post_type' => $type, 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids',
        'meta_key' => $parentKey, 'meta_value' => $post->databaseId]);
      return ['nodes' => array_map(function ($i) use ($load, $ctx) { return $load($i, $ctx); }, $ids)];
    };
  };
  register_graphql_object_type('LsModuleList', ['fields' => ['nodes' => ['type' => ['list_of' => 'Module']]]]);
  register_graphql_object_type('LsLessonList', ['fields' => ['nodes' => ['type' => ['list_of' => 'Lesson']]]]);
  register_graphql_field('Course', 'modules', ['type' => 'LsModuleList', 'resolve' => $children('module', 'course_id')]);
  register_graphql_field('Module', 'lessons', ['type' => 'LsLessonList', 'resolve' => $children('lesson', 'module_id')]);

  register_graphql_field('Module', 'course', ['type' => 'Course', 'resolve' => function ($p, $a, $c) use ($load) {
    return $load(ls_meta($p->databaseId, 'course_id'), $c);
  }]);
  register_graphql_field('Lesson', 'module', ['type' => 'Module', 'resolve' => function ($p, $a, $c) use ($load) {
    return $load(ls_meta($p->databaseId, 'module_id'), $c);
  }]);

  register_graphql_object_type('LsModuleFields', ['fields' => ['description' => $str, 'order' => $int]]);
  register_graphql_field('Module', 'moduleFields', ['type' => 'LsModuleFields', 'resolve' => function ($p) {
    return ['description' => ls_meta($p->databaseId, 'description'), 'order' => (int) ls_meta($p->databaseId, 'order')];
  }]);

  register_graphql_object_type('LsLessonFields', ['fields' => [
    'lessonType' => $str, 'content' => $str, 'videoUrl' => $str, 'duration' => $int, 'objectives' => $strs,
    'order' => $int, 'required' => ['type' => 'Boolean'], 'resources' => $links,
  ]]);
  register_graphql_field('Lesson', 'lessonFields', ['type' => 'LsLessonFields', 'resolve' => function ($p) {
    $id = $p->databaseId;
    return [
      'lessonType' => ls_meta($id, 'lesson_type'), 'content' => get_post_field('post_content', $id), 'videoUrl' => ls_meta($id, 'video_url'),
      'duration' => (int) ls_meta($id, 'duration'), 'objectives' => ls_lines($id, 'objectives'), 'order' => (int) ls_meta($id, 'order'),
      'required' => ls_meta($id, 'required') !== '0', 'resources' => ls_links($id, 'resources'),
    ];
  }]);

  register_graphql_object_type('LsInstructorFields', ['fields' => [
    'bio' => $str, 'expertise' => $strs, 'socialLinks' => $links, 'photo' => ['type' => 'LsImage'],
  ]]);
  register_graphql_field('Instructor', 'instructorFields', ['type' => 'LsInstructorFields', 'resolve' => function ($p) {
    return [
      'bio' => ls_meta($p->databaseId, 'bio'), 'expertise' => ls_lines($p->databaseId, 'expertise'),
      'socialLinks' => ls_links($p->databaseId, 'social_links'), 'photo' => null,
    ];
  }]);
});

// Signed webhooks -> LearnSphere API (see apps/api/src/modules/wordpress/routes.ts).
function ls_send_webhook($event, $wpId) {
  $url = getenv('LS_WEBHOOK_URL');
  $secret = getenv('LS_WEBHOOK_SECRET');
  if (!$url || !$secret) return;
  $body = wp_json_encode(['id' => wp_generate_uuid4(), 'event' => $event, 'wpId' => (int) $wpId]);
  wp_remote_post($url, ['timeout' => 15, 'body' => $body, 'headers' => [
    'Content-Type' => 'application/json', 'X-WP-Signature' => 'sha256=' . hash_hmac('sha256', $body, $secret),
  ]]);
}
add_action('transition_post_status', function ($new, $old, $post) {
  if (defined('LS_SEEDING') || $post->post_type !== 'course') return;
  if ($new === 'publish') ls_send_webhook($old === 'publish' ? 'course.updated' : 'course.published', $post->ID);
  elseif ($old === 'publish') ls_send_webhook('course.unpublished', $post->ID);
}, 10, 3);
add_action('save_post_lesson', function ($id, $post) {
  if (!defined('LS_SEEDING') && $post->post_status === 'publish') ls_send_webhook('lesson.updated', $id);
}, 10, 2);
