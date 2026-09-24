<?php
// Adds the expanded demo catalogue to an existing install. Idempotent: skips any course/instructor
// whose slug already exists, so it is safe to re-run. Run: wp eval-file add-courses.php
// No webhooks fire while this runs (LS_SEEDING) — follow with resync-courses.php to sync the API.
define('LS_SEEDING', true);

function ls_find($type, $slug) {
  $p = get_page_by_path($slug, OBJECT, $type);
  return $p ? $p->ID : null;
}

function ls_upsert_instructor($name, $slug, $bio, $expertise) {
  if ($id = ls_find('instructor', $slug)) return $id;
  $id = wp_insert_post(['post_type' => 'instructor', 'post_title' => $name, 'post_name' => $slug, 'post_status' => 'publish']);
  update_post_meta($id, 'bio', $bio);
  update_post_meta($id, 'expertise', implode("\n", $expertise));
  return $id;
}

$sarah = ls_find('instructor', 'sarah-chen');
$marcus = ls_find('instructor', 'marcus-rivera');
$daniel = ls_upsert_instructor('Daniel Okafor', 'daniel-okafor', 'Platform engineer who has run production infrastructure at scale for a decade.', ['Docker', 'Kubernetes', 'Node.js', 'Security']);
$aisha = ls_upsert_instructor('Aisha Khan', 'aisha-khan', 'Machine learning engineer focused on making AI practical for everyday developers.', ['Machine Learning', 'LLMs', 'Python']);
$elena = ls_upsert_instructor('Elena Rossi', 'elena-rossi', 'Product leader who has shipped products used by millions across three startups.', ['Product Management', 'Strategy', 'Discovery']);

$yt = fn($id) => "https://www.youtube.com/watch?v=$id";
$R = [
  'react' => ['React Docs|https://react.dev/learn'],
  'ts' => ['TypeScript Handbook|https://www.typescriptlang.org/docs/handbook/intro.html'],
  'node' => ['Node.js Learn|https://nodejs.org/en/learn'],
  'docker' => ['Docker Docs|https://docs.docker.com/get-started/'],
  'k8s' => ['Kubernetes Basics|https://kubernetes.io/docs/tutorials/kubernetes-basics/'],
  'git' => ['Pro Git Book|https://git-scm.com/book/en/v2'],
  'ml' => ['Google ML Crash Course|https://developers.google.com/machine-learning/crash-course'],
  'prompt' => ['Anthropic Prompt Engineering Guide|https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview'],
  'figma' => ['Figma Learn|https://help.figma.com/hc/en-us/categories/360002051613'],
  'pm' => ['Atlassian Product Management Guide|https://www.atlassian.com/agile/product-management'],
  'sec' => ['OWASP Top 10|https://owasp.org/www-project-top-ten/'],
];

// [title, slug, instructor, minutes, difficulty, category, featured, short, objectives, prerequisites, resources, modules]
// module: [title, [[lesson title, slug, type, minutes, video url or '', html body], ...]]
$courses = [
  ['React for Beginners', 'react-for-beginners', $sarah, 210, 'beginner', 'Web Development', true,
    'Build interactive user interfaces with components, props and state.',
    ['Build components', 'Manage state with hooks', 'Render lists and handle events'], ['JavaScript Fundamentals'], 'react',
    [['Components', [
      ['Thinking in Components', 'react-components', 'video', 25, $yt('SqcY0GlETPk'), '<h2>Thinking in components</h2><p>A React app is a tree of small, reusable <strong>components</strong>. Each one is a function that returns what should appear on screen.</p><pre><code>function Greeting({ name }) {\n  return &lt;h1&gt;Hello, {name}&lt;/h1&gt;;\n}</code></pre>'],
      ['Props and Composition', 'react-props', 'article', 20, '', '<h2>Props</h2><p>Props pass data <em>down</em> from a parent to a child. They are read-only: a component never changes its own props.</p><ul><li>Pass data with attributes: <code>&lt;Greeting name="Ada" /&gt;</code></li><li>Compose small components into bigger ones</li></ul>'],
    ]], ['State and Events', [
      ['useState in Practice', 'react-usestate', 'video', 30, $yt('SqcY0GlETPk'), '<h2>useState</h2><p><code>useState</code> gives a component memory. Updating state re-renders the component.</p><pre><code>const [count, setCount] = useState(0);\n&lt;button onClick={() =&gt; setCount(count + 1)}&gt;{count}&lt;/button&gt;</code></pre>'],
      ['Rendering Lists', 'react-lists', 'article', 20, '', '<h2>Rendering lists</h2><p>Use <code>map</code> to turn data into elements, and give every item a stable <code>key</code> so React can track it between renders.</p>'],
    ]]]],
  ['TypeScript Essentials', 'typescript-essentials', $sarah, 150, 'intermediate', 'Programming', false,
    'Add static types to JavaScript and catch bugs before they ship.',
    ['Annotate functions and objects', 'Use unions and generics'], ['JavaScript Fundamentals'], 'ts',
    [['Type Basics', [
      ['Why TypeScript?', 'ts-why', 'video', 20, $yt('d56mG7DezGs'), '<h2>Why TypeScript?</h2><p>TypeScript checks your code <strong>before</strong> it runs, turning whole classes of runtime errors into editor warnings.</p>'],
      ['Types, Interfaces and Unions', 'ts-types', 'article', 30, '', '<h2>Describing data</h2><pre><code>interface User { id: string; name: string; role: "admin" | "student"; }</code></pre><p>Union types like <code>"admin" | "student"</code> restrict a value to a known set.</p>'],
      ['Generics', 'ts-generics', 'article', 25, '', '<h2>Generics</h2><p>Generics let one function work with many types while staying type-safe: <code>function first&lt;T&gt;(xs: T[]): T | undefined</code>.</p>'],
    ]]]],
  ['Node.js & REST APIs', 'nodejs-rest-apis', $daniel, 200, 'intermediate', 'Web Development', false,
    'Build and structure a production-ready REST API with Node.js.',
    ['Design RESTful routes', 'Validate input', 'Handle errors consistently'], ['JavaScript Fundamentals'], 'node',
    [['Foundations', [
      ['How Node.js Works', 'node-intro', 'video', 25, $yt('TlB_eWDSMt4'), '<h2>The event loop</h2><p>Node runs JavaScript on a single thread and handles I/O asynchronously, which makes it excellent for network services.</p>'],
      ['Designing REST Routes', 'node-rest-design', 'article', 25, '', '<h2>REST conventions</h2><ul><li><code>GET /courses</code> lists</li><li><code>GET /courses/:id</code> reads one</li><li><code>POST /courses</code> creates</li></ul><p>Use nouns for resources and HTTP verbs for actions.</p>'],
      ['Validation and Errors', 'node-validation', 'article', 25, '', '<h2>Never trust input</h2><p>Validate every request body at the boundary (for example with <strong>zod</strong>) and return a consistent error shape so clients can handle failures predictably.</p>'],
    ]]]],
  ['Docker Fundamentals', 'docker-fundamentals', $daniel, 120, 'beginner', 'Cloud & DevOps', false,
    'Package any app into a container that runs the same everywhere.',
    ['Write a Dockerfile', 'Run and inspect containers'], [], 'docker',
    [['Containers', [
      ['Images vs Containers', 'docker-images', 'video', 25, $yt('pTFZFxd4hOI'), '<h2>Images and containers</h2><p>An <strong>image</strong> is a read-only template; a <strong>container</strong> is a running instance of it.</p>'],
      ['Writing a Dockerfile', 'docker-dockerfile', 'article', 25, '', '<h2>Dockerfile basics</h2><pre><code>FROM node:22-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["node", "index.js"]</code></pre>'],
    ]]]],
  ['Kubernetes in Practice', 'kubernetes-in-practice', $daniel, 240, 'advanced', 'Cloud & DevOps', true,
    'Deploy, scale and operate containerised apps on Kubernetes.',
    ['Understand pods and deployments', 'Expose services', 'Roll out updates safely'], ['Docker Fundamentals'], 'k8s',
    [['Core Objects', [
      ['Pods, Deployments and Services', 'k8s-objects', 'video', 40, $yt('X48VuDVv0do'), '<h2>The core objects</h2><ul><li><strong>Pod</strong>: one or more containers scheduled together</li><li><strong>Deployment</strong>: keeps N replicas running</li><li><strong>Service</strong>: a stable address in front of pods</li></ul>'],
      ['Rolling Updates', 'k8s-rollouts', 'article', 30, '', '<h2>Zero-downtime deploys</h2><p>Deployments replace pods gradually, so traffic keeps flowing while a new version rolls out. Roll back with <code>kubectl rollout undo</code>.</p>'],
    ]]]],
  ['Git & GitHub Essentials', 'git-github-essentials', $sarah, 90, 'beginner', 'Programming', false,
    'Track changes, collaborate with pull requests and never lose work again.',
    ['Commit and branch', 'Open and review pull requests'], [], 'git',
    [['Version Control', [
      ['Commits and Branches', 'git-basics', 'video', 30, $yt('8JJ101D3knE'), '<h2>Snapshots, not diffs</h2><p>Each <strong>commit</strong> is a snapshot of your project. <strong>Branches</strong> let you work on changes in isolation.</p><pre><code>git switch -c feature/login\ngit commit -am "Add login form"</code></pre>'],
      ['Pull Requests', 'git-pull-requests', 'article', 20, '', '<h2>Collaborating with PRs</h2><p>A pull request proposes merging one branch into another, giving teammates a place to review, discuss and run CI before the change lands.</p>'],
    ]]]],
  ['Machine Learning Foundations', 'machine-learning-foundations', $aisha, 300, 'intermediate', 'AI & Machine Learning', true,
    'Understand how models learn from data and train your first classifier.',
    ['Frame problems as supervised learning', 'Evaluate models properly'], ['Python for Data Analysis'], 'ml',
    [['Core Ideas', [
      ['What Is Machine Learning?', 'ml-intro', 'video', 40, $yt('i_LwzRVP7bg'), '<h2>Learning from data</h2><p>Instead of writing rules by hand, we give a model examples and let it find the pattern.</p>'],
      ['Training and Evaluation', 'ml-evaluation', 'article', 35, '', '<h2>Train / test split</h2><p>Always evaluate on data the model has <strong>never seen</strong>. Otherwise you are measuring memorisation, not learning.</p><ul><li>Accuracy for balanced classes</li><li>Precision and recall when classes are imbalanced</li></ul>'],
    ]]]],
  ['Prompt Engineering with LLMs', 'prompt-engineering', $aisha, 90, 'beginner', 'AI & Machine Learning', false,
    'Write prompts that get reliable, useful results from large language models.',
    ['Structure clear prompts', 'Give examples and context'], [], 'prompt',
    [['Prompting', [
      ['Anatomy of a Good Prompt', 'prompt-anatomy', 'article', 20, '', '<h2>Be specific</h2><p>Good prompts state the <strong>role</strong>, the <strong>task</strong>, the <strong>context</strong> and the <strong>output format</strong>.</p>'],
      ['Few-shot Examples', 'prompt-few-shot', 'article', 20, '', '<h2>Show, don\'t just tell</h2><p>Including two or three worked examples in the prompt is often the fastest way to get consistent output.</p>'],
    ]]]],
  ['Figma for UI Design', 'figma-ui-design', $sarah, 120, 'beginner', 'Design', false,
    'Go from wireframe to polished mockup in Figma.',
    ['Use frames and auto layout', 'Build reusable components'], ['UX Design Basics'], 'figma',
    [['Designing in Figma', [
      ['Frames and Auto Layout', 'figma-auto-layout', 'video', 30, $yt('c9Wg6Cb_YlU'), '<h2>Auto layout</h2><p>Auto layout makes designs respond to content like real UI does: add text and the button grows.</p>'],
      ['Components and Variants', 'figma-components', 'article', 25, '', '<h2>Design systems start here</h2><p>Turn repeated elements into <strong>components</strong> and use <strong>variants</strong> for states like hover and disabled.</p>'],
    ]]]],
  ['Product Management 101', 'product-management-101', $elena, 100, 'beginner', 'Business', false,
    'Learn how great products are discovered, prioritised and shipped.',
    ['Run customer discovery', 'Prioritise a roadmap'], [], 'pm',
    [['The PM Role', [
      ['What a Product Manager Does', 'pm-role', 'article', 20, '', '<h2>The PM\'s job</h2><p>A product manager decides <strong>what</strong> to build and <strong>why</strong>, working with design and engineering who own the <em>how</em>.</p>'],
      ['Prioritisation Frameworks', 'pm-prioritisation', 'article', 25, '', '<h2>RICE</h2><p>Score ideas by <strong>R</strong>each, <strong>I</strong>mpact, <strong>C</strong>onfidence and <strong>E</strong>ffort to compare them on one scale.</p>'],
    ]]]],
  ['Web Security Basics', 'web-security-basics', $daniel, 130, 'intermediate', 'Security', false,
    'Understand and defend against the most common web vulnerabilities.',
    ['Prevent XSS and injection', 'Handle auth and secrets safely'], ['Node.js & REST APIs'], 'sec',
    [['Common Attacks', [
      ['Cross-Site Scripting (XSS)', 'sec-xss', 'article', 25, '', '<h2>XSS</h2><p>XSS happens when untrusted input is rendered as HTML. Escape output by default and sanitise any HTML you must render (for example with <strong>DOMPurify</strong>).</p>'],
      ['SQL Injection', 'sec-sqli', 'article', 25, '', '<h2>Parameterise everything</h2><p>Never build SQL by string concatenation. Use parameterised queries so input is always treated as data.</p><pre><code>db.query("SELECT * FROM users WHERE email = $1", [email])</code></pre>'],
    ]]]],
];

$added = 0;
foreach ($courses as [$title, $slug, $inst, $dur, $diff, $cat, $featured, $short, $objectives, $prereq, $resKey, $modules]) {
  if (ls_find('course', $slug)) { echo "exists $slug\n"; continue; }
  $cid = wp_insert_post(['post_type' => 'course', 'post_title' => $title, 'post_name' => $slug, 'post_status' => 'publish']);
  foreach ([
    'short_description' => $short, 'description' => $short, 'duration' => $dur, 'difficulty' => $diff, 'category' => $cat,
    'tags' => implode("\n", [strtolower($cat), $diff]), 'featured' => $featured ? 1 : 0, 'seo_title' => "$title | LearnSphere",
    'seo_description' => $short, 'target_audience' => 'Self-paced learners', 'learning_objectives' => implode("\n", $objectives),
    'prerequisites' => implode("\n", $prereq), 'instructor_id' => $inst,
  ] as $k => $v) update_post_meta($cid, $k, $v);

  foreach ($modules as $mi => [$mtitle, $lessons]) {
    $mid = wp_insert_post(['post_type' => 'module', 'post_title' => $mtitle, 'post_name' => "$slug-module-" . ($mi + 1), 'post_status' => 'publish']);
    update_post_meta($mid, 'course_id', $cid);
    update_post_meta($mid, 'order', $mi);
    foreach ($lessons as $li => [$ltitle, $lslug, $type, $ldur, $video, $body]) {
      $lid = wp_insert_post(['post_type' => 'lesson', 'post_title' => $ltitle, 'post_name' => $lslug, 'post_status' => 'publish',
        'post_content' => wp_slash(str_replace('\n', "\n", $body))]);
      foreach ([
        'module_id' => $mid, 'lesson_type' => $type, 'duration' => $ldur, 'order' => $li, 'required' => 1,
        'video_url' => $video, 'objectives' => '', 'resources' => implode("\n", $R[$resKey]),
      ] as $k => $v) update_post_meta($lid, $k, $v);
    }
  }
  echo "added $slug ($cid)\n";
  $added++;
}
echo "added $added courses\n";
