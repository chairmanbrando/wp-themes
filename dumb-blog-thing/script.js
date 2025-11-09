(function ($) {

// Enums, I guess. 🤷‍♀️
const C = {
    TOOLTIPSTATE: Object.freeze({
        READY:   1,
        WAITING: 0,
        BUSTED: -1
    }),

    TOOLTIPTYPE: Object.freeze({
        WIKIPEDIA:  1,
        LOCALIMAGE: 2
    })
};

class Tooltipper {

    #endpoint;
    #links;
    #images;
    #tooltips;

    constructor() {
        this.#links  = this.getWikipediaLinks();
        this.#images = this.getLocalImageLinks();

        if (! this.#links.length && ! this.#images.length) return;

        this.#endpoint = new URL('https://en.wikipedia.org/w/api.php');
        this.#endpoint.searchParams.append('action', 'query');
        this.#endpoint.searchParams.append('prop', 'extracts');
        this.#endpoint.searchParams.append('format', 'json');
        this.#endpoint.searchParams.append('exintro', true);
        this.#endpoint.searchParams.append('explaintext', true);
        this.#endpoint.searchParams.append('exchars', 1200);
        this.#endpoint.searchParams.append('origin', '*');

        this.createTooltips();
        this.addListeners();
    }

    get endpoint() {
        return this.#endpoint.toString();
    }

    get images() {
        return this.#images;
    }

    get links() {
        return this.#links;
    }

    get tooltips() {
        return this.#tooltips;
    }

    addListeners() {
        this.#links.forEach((link) => {
            link.wikiSlug = link.href.split('/').pop();

            link.addEventListener('mouseenter', (e) => {
                this.mouseEnter(e.target);
            });

            link.addEventListener('mouseleave', (e) => {
                e.target.tooltipper.classList.remove('show');
            });
        });

        this.#images.forEach((image) => {
            image.addEventListener('mouseenter', (e) => {
                e.target.tooltipper.classList.add('show');
            });

            image.addEventListener('mouseleave', (e) => {
                e.target.tooltipper.classList.remove('show');
            });
        });
    }

    createTooltip(type, link, i) {
        const tooltip = document.createElement('div');
          let content;

        // `left` and `top` are calculated on initial hover.
        tooltip.type = type;
        tooltip.id   = `tooltip-${i}`;

        tooltip.classList.add('tooltip');

        switch (type) {
            case C.TOOLTIPTYPE.WIKIPEDIA:
                tooltip.classList.add('wikipedia');
                content = `
                        <h2 class="title">%title%</h2>
                        <div class="extract">%extract%</div>
                    `;
                break;

            case C.TOOLTIPTYPE.LOCALIMAGE:
                tooltip.classList.add('local-image');

                if (link.dataset.extension === 'mp4') {
                    content = `<video src="${link.href}" autoplay loop muted>`;
                } else {
                    content = `<img src="${link.href}" alt="">`;
                }

                break;
        }

        tooltip.insertAdjacentHTML('beforeend', content);
        document.querySelector('#page').insertAdjacentElement('beforeend', tooltip);

        return tooltip;
    }

    createTooltips() {
        this.#tooltips = [];

        this.#links.forEach((link, i) => {
            const tooltip = this.createTooltip(C.TOOLTIPTYPE.WIKIPEDIA, link, i);

            link.tooltipType = C.TOOLTIPTYPE.WIKIPEDIA;
            link.tooltipper  = tooltip;
            link.tooltipperI = i;

            this.#tooltips.push(tooltip);
        });

        this.#images.forEach((image, i) => {
            const tooltip = this.createTooltip(C.TOOLTIPTYPE.LOCALIMAGE, image, i);

            image.tooltipType = C.TOOLTIPTYPE.LOCALIMAGE;
            image.tooltipper  = tooltip;
            image.tooltipperI = i;

            this.#tooltips.push(tooltip);
        });
    }

    getPageExtract(title, fnSuccess) {
        title = decodeURIComponent(title); // In case of justness.
        this.#endpoint.searchParams.append('titles', title);

        return $.ajax({
            url:      this.endpoint,
            method:   'GET',
            success:  (data) => {
                const pages = data.query.pages;
                const page  = Object.values(pages)[0];

                this.#endpoint.searchParams.delete('titles');
                fnSuccess(Object.keys(pages)[0] === -1 ? false : page);
            }
        });
    }

    getWikipediaLinks() {
        return Array.from(document.querySelectorAll('#content a')).filter((link) => {
            return (link.hostname.indexOf('wikipedia.org') > -1 && link.href.indexOf('#') === -1);
        });
    }

    getLocalImageLinks() {
        return Array.from(document.querySelectorAll('#content a')).filter((link) => {
            const imgs = ['gif', 'jpg', 'jpeg', 'mp4', 'png', 'webp'];
            const ext  = link.href.split('.').pop();

            link.dataset.extension = ext;

            return (link.classList.contains('internal') && imgs.indexOf(ext) > -1);
        });
    }

    hydrateTooltip(tooltip, page) {
        if (page?.pageid  === undefined) return false;
        if (page?.title   === undefined) return false;
        if (page?.extract === undefined) return false;

        const title   = tooltip.querySelector('.title');
        const extract = tooltip.querySelector('.extract');

        page.extract      = page.extract.trim().replaceAll('\n\n', '\n');
        page.extract      = page.extract.trim().replaceAll('\n', '<br><br>');
        page.extract      = page.extract.trim().replaceAll('()', '');
        title.textContent = title.textContent.replace('%title%', page.title);
        extract.innerHTML = extract.innerHTML.replace('%extract%', `<p>${page.extract}</p>`);

        return true;
    }

    mouseEnter(link) {
        if (link.tooltipState === C.TOOLTIPSTATE.WAITING) return;
        if (link.tooltipState === C.TOOLTIPSTATE.BUSTED)  return;

        // @@ Make this a method.
        if (! link.tooltipper.style.top) {
            const extra = getComputedStyle(document.documentElement).marginTop;
            const left  = document.querySelector('.entry-content p').offsetLeft;
            const top   = link.getBoundingClientRect().bottom - parseInt(extra, 10) + window.scrollY;

            link.tooltipper.style.top = `calc(${top}px + 1rem)`;
            link.tooltipper.style.left = `calc(${left}px + 1rem)`;
        }

        if (link.tooltipState === C.TOOLTIPSTATE.READY) {
            link.tooltipper.classList.add('show');
        } else {
            link.tooltipState = C.TOOLTIPSTATE.WAITING;
            link.classList.add('wait');

            this.getPageExtract(link.wikiSlug, (page) => {
                if (this.hydrateTooltip(link.tooltipper, page)) {
                    link.tooltipState = C.TOOLTIPSTATE.READY;
                    link.tooltipper.classList.add('show');
                } else {
                    link.tooltipState = C.TOOLTIPSTATE.BUSTED
                }

                link.classList.remove('wait');
            });
        }
    }

}

// Stops certain events from running at full speed.
function throttleRaf(fn) {
    let busy = false;

    return function (...args) {
        if (! busy) {
            requestAnimationFrame(() => {
                fn.apply(this, args);
                busy = false;
            });

            busy = true;
        }
    };
}

// Stops certain events from running at full speed.
function throttleTime(fn, ms) {
    let busy = false;

    return function (...args) {
        if (! busy) {
            setTimeout(() => {
                fn.apply(this, args);
                busy = false;
            }, ms);

            busy = true;
        }
    }
}

// For some reason WP doesn't link to the full-size images. 🤷‍♀️
function galleryLinkFix() {
    $('.wp-block-gallery img').each(function (i, image) {
        const src = image.src.replace(/-\d+x\d+\./, '.');
        $(image).wrap(`<a href="${src}" target="_blank" xpopovertarget="popover" />`);
    });
}

function mobileMenuButtonFix() {
    const intheway = document.querySelector('#announcement');
    const button   = document.querySelector('#primary-mobile-menu');

    if (! intheway) return;

    button.style.marginTop = `${intheway.offsetHeight}px`;
}

function newTabifyLinks() {
    document.body.querySelectorAll('a').forEach((link) => {
        if (link.hostname === window.location.hostname) {
            link.classList.add('internal');
        } else {
            link.classList.add('external');
            link.target = '_blank';
        }
    });
};

// Have to delay until the highlighting is done, and if there's an event I could
// tap into to mark such a thing, I don't know it. As usual, my distaste for the
// syntax of the MutationObserver API has me being gross with `setInterval()`.
//
// @dev Seems fine now? Which makes this no longer necessary. Not sure why the
// highlighting seemed not to work before. 🤷‍♀️
function phpCodeBlocksFix() {
    const spanWatch = setInterval(() => {
        if (document.querySelector('code.language-php span')) {
            clearInterval(spanWatch);
            setTimeout(() => $('code.language-php').wrap('<pre class="php-wrapper" />'), 100);
        }
    }, 100);
}

function popoverHandling() {
    $(document.body).append('<div id="popover" popover />');

    const popover = $('#popover').get(0);

    $('a[popovertarget]').on('click', (e) => {
        popover.innerHTML = `<img src="${e.delegateTarget.href}">`
        popover.showPopover(e.delegateTarget);
        e.preventDefault();
    });

    // In lieu of a close button -- maybe for now, maybe forever.
    popover.addEventListener('click', () => popover.hidePopover());
}

function rotateHueTitleHover() {
    const $page  = document.getElementById('page');
    const $title = document.querySelector('.site-title');
    const width  = $title.offsetWidth;

    function hueItUp(x) {
        $title.style.setProperty('--afterWidth', `${x / width * 100}%`);
        $page.style.setProperty('--filterHue', `hue-rotate(${x / width * 360}deg)`);
        $page.style.setProperty('filter', `hue-rotate(${x / width * 360}deg)`);

        // Instead of assigning each magenta element the `--filterHue` property
        // in CSS, for now we'll reverse the things that shouldn't be rotated.
        $page.querySelectorAll(':scope :is(figure img, img, svg, video').forEach((e) => {
            e.style.setProperty('filter', `hue-rotate(-${x / width * 360}deg)`);
        });
    }

    let xOff = localStorage.getItem('huePreference');
        xOff && hueItUp(xOff);

    $title.addEventListener('mousemove', (e) => hueItUp(xOff = e.offsetX));
    $title.addEventListener('mouseleave', () => localStorage.setItem('huePreference', xOff));
}

document.addEventListener('DOMContentLoaded', () => {
    rotateHueTitleHover();

    galleryLinkFix();
    mobileMenuButtonFix();
    newTabifyLinks();
    // popoverHandling();

    $('#comments:not(.show)').on('mouseenter touchstart', (e) => $(e.target).addClass('show'));

    // We'll wait a moment for other JS things (like embeds) to run first.
    if (window.innerWidth > 1024) {
        setTimeout(() => window.tt = new Tooltipper, 1000);
    }
});

})(jQuery);
