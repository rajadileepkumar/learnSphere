<?php
// One-off / repeatable: push lesson-content.php into lessons that already exist. Run: wp eval-file update-content.php
// Saving a lesson fires the normal lesson.updated webhook, so the API re-syncs each affected course.
$content = require __DIR__ . '/lesson-content.php';
foreach ($content as $slug => [$type, $video, $html, $res]) {
  $post = get_page_by_path($slug, OBJECT, 'lesson');
  if (!$post) { echo "missing $slug\n"; continue; }
  wp_update_post(['ID' => $post->ID, 'post_content' => wp_slash($html)]);
  update_post_meta($post->ID, 'lesson_type', $type);
  update_post_meta($post->ID, 'video_url', $video);
  update_post_meta($post->ID, 'resources', implode("\n", $res));
  echo "updated $slug\n";
}
