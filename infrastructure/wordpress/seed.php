<?php
// Demo content. Course/lesson slugs for the first three courses intentionally match the rows the API
// already has in Postgres, so a follow-up ID remap keeps existing enrollments, progress and quizzes.
define('LS_SEEDING', true);

function ls_make($type, $title, $slug, $content, $meta) {
  $id = wp_insert_post(['post_type' => $type, 'post_title' => $title, 'post_name' => $slug, 'post_content' => $content, 'post_status' => 'publish']);
  foreach ($meta as $k => $v) update_post_meta($id, $k, is_array($v) ? implode("\n", $v) : $v);
  return $id;
}

$sarah = ls_make('instructor', 'Sarah Chen', 'sarah-chen', '', [
  'bio' => 'Former staff engineer turned educator. Ten years building web platforms and teaching JavaScript.',
  'expertise' => ['JavaScript', 'Web Development', 'System Design'],
  'social_links' => ['GitHub|https://github.com/', 'LinkedIn|https://linkedin.com/'],
]);
$marcus = ls_make('instructor', 'Marcus Rivera', 'marcus-rivera', '', [
  'bio' => 'Data engineer and analyst who loves making databases approachable for beginners.',
  'expertise' => ['SQL', 'Python', 'Data Analysis'],
  'social_links' => ['LinkedIn|https://linkedin.com/'],
]);

$video = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
$courses = [
  ['Intro to LearnSphere', 'intro-to-learnsphere', $sarah, 60, 'beginner', 'Platform', true, 'A quick tour of how learning works on LearnSphere.',
    ['Navigate the platform', 'Track your progress', 'Earn a verifiable certificate'], [],
    [['Core Lessons', [
      ['Welcome', 'welcome', 'video', 5, 'Welcome to LearnSphere! In this short video we cover what you will learn and how the platform is organised.', ['Meet your instructor', 'Understand the course layout']],
      ['How the Platform Works', 'how-it-works', 'article', 10, '<p>Courses are split into modules, and modules into lessons. Complete every required lesson to finish a course and earn a certificate you can share and verify publicly.</p><p>Use the <strong>AI Tutor</strong> any time you are stuck, and jot down <strong>Notes</strong> as you go.</p>', ['Know how progress is tracked']],
      ['Your First Steps', 'first-steps', 'video', 15, 'A guided walk-through of enrolling in a course, completing a lesson and taking a quiz.', ['Enroll in a course', 'Complete a lesson']],
    ]]]],
  ['JavaScript Fundamentals', 'javascript-fundamentals', $sarah, 180, 'beginner', 'Programming', true, 'Learn the core language every web developer needs.',
    ['Use variables and types confidently', 'Write and compose functions', 'Handle asynchronous code with promises'], ['A computer and curiosity'],
    [['Core Lessons', [
      ['Variables and Types', 'variables', 'video', 20, 'Understand let, const, primitive types and how JavaScript coerces values.', ['Declare variables correctly']],
      ['Functions', 'functions', 'video', 25, 'Function declarations, arrow functions, closures and higher-order functions.', ['Write reusable functions']],
      ['Promises and Async/Await', 'async', 'article', 30, '<p>Promises represent a value that will exist later. <code>async</code>/<code>await</code> lets you write asynchronous code that reads top-to-bottom.</p>', ['Use async/await']],
    ]]]],
  ['SQL for Beginners', 'sql-for-beginners', $marcus, 120, 'intermediate', 'Data', false, 'Query relational databases with confidence.',
    ['Write SELECT queries', 'Combine tables with joins'], ['Basic spreadsheet familiarity'],
    [['Core Lessons', [
      ['SELECT Basics', 'select', 'video', 20, 'Selecting columns, filtering with WHERE, sorting and limiting results.', ['Filter and sort rows']],
      ['Joins Explained', 'joins', 'article', 30, '<p>INNER, LEFT and RIGHT joins explained with simple diagrams and examples.</p>', ['Choose the right join']],
    ]]]],
  ['Python for Data Analysis', 'python-for-data-analysis', $marcus, 240, 'intermediate', 'Data', true, 'Clean, explore and visualise data with Python.',
    ['Load and clean datasets', 'Summarise data with pandas', 'Build simple charts'], ['Basic programming knowledge'],
    [['Getting Started', [
      ['Setting Up Python', 'setting-up-python', 'video', 15, 'Install Python, create a virtual environment and open a notebook.', ['Run your first script']],
      ['Working with DataFrames', 'dataframes', 'video', 35, 'Create, filter and reshape DataFrames with pandas.', ['Filter rows and columns']],
    ]], ['Analysis', [
      ['Cleaning Messy Data', 'cleaning-data', 'article', 30, '<p>Missing values, duplicates and inconsistent types - practical techniques to fix each.</p>', ['Handle missing values']],
      ['Visualising Results', 'visualising-results', 'video', 25, 'Turn tables into clear charts using matplotlib.', ['Create a bar and line chart']],
    ]]]],
  ['UX Design Basics', 'ux-design-basics', $sarah, 150, 'beginner', 'Design', false, 'Design interfaces people actually enjoy using.',
    ['Apply core usability principles', 'Sketch and test simple flows'], [],
    [['Foundations', [
      ['What Is UX?', 'what-is-ux', 'video', 12, 'The difference between UX and UI, and why research comes first.', ['Define UX']],
      ['Wireframing', 'wireframing', 'article', 25, '<p>Low-fidelity wireframes let you test ideas quickly before investing in visual design.</p>', ['Sketch a wireframe']],
    ]]]],
];

$map = [];
foreach ($courses as [$title, $slug, $inst, $dur, $diff, $cat, $featured, $short, $objectives, $prereq, $modules]) {
  $cid = ls_make('course', $title, $slug, '', [
    'short_description' => $short, 'description' => $short . ' This course is part of the LearnSphere demo catalogue.',
    'duration' => $dur, 'difficulty' => $diff, 'category' => $cat, 'tags' => [strtolower($cat), $diff], 'featured' => $featured ? 1 : 0,
    'seo_title' => $title . ' | LearnSphere', 'seo_description' => $short, 'target_audience' => 'Self-paced learners',
    'learning_objectives' => $objectives, 'prerequisites' => $prereq, 'instructor_id' => $inst,
  ]);
  $map[$slug] = ['course' => $cid, 'modules' => [], 'lessons' => []];
  foreach ($modules as $mi => [$mtitle, $lessons]) {
    $mid = ls_make('module', $mtitle, $slug . '-module-' . ($mi + 1), '', ['course_id' => $cid, 'order' => $mi, 'description' => $mtitle]);
    $map[$slug]['modules'][] = $mid;
    foreach ($lessons as $li => [$ltitle, $lslug, $type, $ldur, $body, $lobj]) {
      $lid = ls_make('lesson', $ltitle, $lslug, $body, [
        'module_id' => $mid, 'lesson_type' => $type, 'duration' => $ldur, 'order' => $li, 'required' => 1,
        'video_url' => $type === 'video' ? $video : '', 'objectives' => $lobj,
        'resources' => ['Course slides|https://example.com/slides.pdf'],
      ]);
      $map[$slug]['lessons'][$lslug] = $lid;
    }
  }
}
update_option('ls_idmap', wp_json_encode($map));
echo "seeded " . count($courses) . " courses\n";
