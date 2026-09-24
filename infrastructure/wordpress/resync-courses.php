<?php
// Sends a signed course.updated webhook for every published course, so the API re-syncs the whole
// catalogue (e.g. after add-courses.php, or after the API starts storing new course fields).
// Run: wp eval-file resync-courses.php
$ids = get_posts(['post_type' => 'course', 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids']);
foreach ($ids as $id) {
  ls_send_webhook('course.updated', $id);
  echo "resynced $id\n";
}
echo 'resynced ' . count($ids) . " courses\n";
