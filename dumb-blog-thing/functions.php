<?php

define('CHILD_URL', get_stylesheet_directory_uri());
define('CHILD_DIR', get_stylesheet_directory());

// ----- @setup ------------------------------------------------------------- //

// Replace dumb shit in the admin bar with links to your posts and pages.
add_action('admin_bar_menu', function ($bar) {
    $bar->remove_node('wp-logo');
    $bar->remove_node('themes');
    $bar->remove_node('widgets');

    $bar->add_node([
        'id'     => 'site-pages',
        'parent' => 'site-name',
        'title'  => 'Pages',
        'href'   => admin_url('edit.php?post_type=page')
    ]);

    $bar->add_node([
        'id'     => 'site-posts',
        'parent' => 'site-name',
        'title'  => 'Posts',
        'href'   => admin_url('edit.php')
    ]);
}, 99);

// Add the current date to the admin bar. It just looks nice.
add_action('admin_bar_menu', function ($bar) {
    $bar->add_menu([
        'id'     => 'adminbar-date',
        'parent' => 'top-secondary',
        'group'  => null,
        'title'  => date('M j, Y', time() + HOUR_IN_SECONDS * get_option('gmt_offset')),
        'href'   => 'https://www.time.gov/',
        'meta'   => ['target' => '_blank']
    ]);
}, 5);

add_action('admin_enqueue_scripts', function () {
?>
    <style>
        .wp-list-table {
            tr.status-draft,
            tr.status-private {
                opacity: 0.75;
            }
        }

        .wp-list-table.fixed .column-categories,
        .wp-list-table.fixed .column-tags {
            width: 10%;
        }
    </style>
    <?php
}, 99);

add_action('admin_init', function () {});

add_action('after_setup_theme', function () {
    // add_editor_style('style-editor.css');

    if (is_admin()) {
        add_action('enqueue_block_assets', function () {
            wp_enqueue_style('editor', CHILD_URL . '/style-editor.css', [], filemtime(CHILD_DIR . '/style.css'));
        });
    }
});

// Enqueue assets. One day I'll use GSAP for something...
add_action('wp_enqueue_scripts', function () {
    // wp_enqueue_script('gsapc', 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js', [], '3.12.5', true);
    // wp_enqueue_script('gsaps', 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js', ['gsapc'], '3.12.5', true);

    wp_enqueue_style('child', CHILD_URL . '/style.css', [], filemtime(CHILD_DIR . '/style.css'));
    wp_enqueue_script('child', CHILD_URL . '/script.js', ['jquery'], filemtime(CHILD_DIR . '/script.js'));
}, 99);

// Removes most emoji-related things.
remove_action('wp_head',             'print_emoji_detection_script', 7);
remove_action('admin_print_scripts', 'print_emoji_detection_script');
remove_action('embed_head',          'print_emoji_detection_script');
remove_action('wp_print_styles',     'print_emoji_styles');
remove_action('admin_print_styles',  'print_emoji_styles');
remove_filter('the_content_feed',    'wp_staticize_emoji');
remove_filter('comment_text_rss',    'wp_staticize_emoji');
remove_filter('wp_mail',             'wp_staticize_emoji_for_email');

// Removes emojis from the classic editor.
add_filter('tiny_mce_plugins', function ($plugins) {
    return (is_array($plugins)) ? array_diff($plugins, ['wpemoji']) : [];
});

// Disables emoji prefetch requests.
add_filter('wp_resource_hints', function ($hints, $relation_type) {
    if ($relation_type === 'dns-prefetch') {
        return array_diff($hints, preg_grep('/emoji/', $hints));
    }

    return $hints;
}, 10, 2);

// ----- @functions --------------------------------------------------------- //

function __dropdown_pages_args($args) {
    return array_merge($args, ['post_status' => ['publish', 'draft', 'private']]);
}

function add_filters($names, $callback, $priority = 10, $args = 1) {
    $names = (! is_array($names)) ? [$names] : $names;

    foreach ($names as $name) {
        add_filter($name, $callback, $priority, $args);
    }
}

// ----- @hooks ------------------------------------------------------------- //

add_filter('comment_form_field_comment', function ($field) {
    $placeholder = __('Add a comment here if you must.');
    $placeholder = sprintf('placeholder="%s"', $placeholder);

    return str_replace('<textarea', "<textarea {$placeholder}", $field);
});

// Add announcement bar if it has content.
add_action('get_template_part', function ($slug) {
    if ($slug !== 'template-parts/header/site-header') return;

    if ($text = get_field('announcement', 'option')) {
        if ($url = get_field('announcement_url', 'option')) {
            $text .= sprintf(' <a href="%s">&xrarr;</a>', $url);
        }

        printf('<div id="announcement">%s</div>', __($text));
    }
});

// Do we need a shortcode or two? Perhaps.
add_action('init', function () {
    // Converts `[win i]` to `⊞ Win`+`i`.
    add_shortcode('win', function ($atts) {
        return sprintf('<kbd>⊞&hairsp;Win</kbd>+<kbd>%s</kbd>', $atts[0]);
    });
});

// Why can you only nest published pages without code intervention?!
add_filter('page_attributes_dropdown_pages_args', '__dropdown_pages_args');
add_filter('quick_edit_dropdown_pages_args',      '__dropdown_pages_args');
add_filter('rest_page_query',                     '__dropdown_pages_args');

// Move drafts to the top of your post list. Private stuff will come next.
add_filter('posts_orderby', function ($orderby) {
    if (! is_admin())                         return $orderby;
    if (! $GLOBALS['pagenow'] === 'edit.php') return $orderby;

    return 'post_status ASC, ' . $orderby;
});

// Disable "texturization" of the text -- i.e. no curly quotes and the like.
add_filter('run_wptexturize', '__return_false');

// I wanted to redirect to a page, but keeping the 404 intact and not sending a
// 302 is proving troublesome. `wp_redirect()` only allows status codes in the
// 300s or it would be the play. Perhaps I need to copy its code and adjust...
add_action('template_redirect', function () {
    if (is_404()) {
        echo file_get_contents(CHILD_DIR . '/404.txt');
        exit;
    }
}, 99);

// Do various content things here...
add_filter('the_content', function ($content) {
    if (is_admin()) return $content;

    // Since texturization is disabled above, we get no ellipses.
    $content = str_replace('...', '&hellip;', $content);

    // WPE fucks inline code that links somewhere, so let's undo that.
    $content = preg_replace('/<code>&lt;a(.+?)&gt;/', '<a$1><code>', $content);
    $content = str_replace('&lt;/a&gt;</code>', '</code></a>', $content);
    $content = str_replace('=&quot;', '="', $content);
    $content = str_replace('&quot;>', '">', $content);

    // Maybe double em dashes are cool? Don't know if browsers or fonts use it.
    return str_replace(' -- ', ' ⸺ ', $content);
});

// Test shit here.
add_action('wp_footer', function () {
    if (! current_user_can('administrator')) return;
});
