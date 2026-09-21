# WordPress CMS for LearnSphere: WPGraphQL + a small mu-plugin defining the content model
# (course -> module -> lesson, instructor) that apps/api/src/modules/wordpress/queries.ts reads.
FROM wordpress:6-php8.3-apache
RUN apt-get update && apt-get install -y --no-install-recommends unzip curl && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL -o /usr/local/bin/wp https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar \
 && chmod +x /usr/local/bin/wp \
 && curl -fsSL -o /tmp/wpgraphql.zip https://downloads.wordpress.org/plugin/wp-graphql.latest-stable.zip \
 && mkdir -p /usr/src/wordpress/wp-content/plugins && unzip -q /tmp/wpgraphql.zip -d /usr/src/wordpress/wp-content/plugins && rm /tmp/wpgraphql.zip
COPY mu-plugins/ /usr/src/wordpress/wp-content/mu-plugins/
COPY seed.php bootstrap.sh /opt/learnsphere/
RUN sed -i 's/[[:cntrl:]]$//' /opt/learnsphere/bootstrap.sh && chmod +x /opt/learnsphere/bootstrap.sh
# Railway can end up with two MPMs enabled ("More than one MPM loaded"); force prefork (required by mod_php).
CMD ["bash", "-c", "rm -f /etc/apache2/mods-enabled/mpm_*.load /etc/apache2/mods-enabled/mpm_*.conf; a2enmod mpm_prefork; /opt/learnsphere/bootstrap.sh & exec docker-entrypoint.sh apache2-foreground"]
