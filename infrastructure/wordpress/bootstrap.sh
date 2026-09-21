#!/bin/bash
# Runs in the background next to Apache: installs WP on first boot, activates WPGraphQL, seeds demo content once.
WP="runuser -u www-data -- wp --path=/var/www/html"
# wp-config.php is written by the image entrypoint; the DB may still be starting. Retry until the install succeeds.
until $WP core is-installed >/dev/null 2>&1 || $WP core install --url="$WP_HOME" --title="LearnSphere CMS" \
    --admin_user="${WP_ADMIN_USER:-admin}" --admin_password="$WP_ADMIN_PASSWORD" \
    --admin_email="${WP_ADMIN_EMAIL:-admin@learnsphere.dev}" --skip-email; do
  sleep 5
done
$WP plugin activate wp-graphql
$WP rewrite structure '/%postname%/' --hard
if [ -z "$($WP option get ls_seeded 2>/dev/null)" ]; then
  $WP eval-file /opt/learnsphere/seed.php && $WP option update ls_seeded 1
fi
