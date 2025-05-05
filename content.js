const config = {
    njuskalo: {
        //ad list
        listSelector: 'section.EntityList--Regular',
        //single ad
        itemSelector: 'li.EntityList-item',
        //url to the single ad page
        hrefAttribute: 'data-href',
        //elector to check for blacklisted words
        checkSelector: ['a.ClassifiedDetailOwnerDetails-logo', 'a.ClassifiedDetailOwnerDetails-placeholderLogoWrapper'],
        blacklist: ['agencija', 'investitor', 'trgovina', 'tvrtka']
    },
    oglasnik: {
        listSelector: '#classifieds-list',
        itemSelector: 'a.classified-box',
        hrefAttribute: 'href',
        checkSelector: ['div.top-details a'],
        blacklist: ['trgovina', 'agencija', 'investitor', 'trgovina']
    },
    indexOglasi: {
        listSelector: 'div[class^="ant-row-flex paginationAds__adList"]',
        itemSelector: 'div.ant-col',
        hrefSelector: 'a[class^="AdLink__link"]',
        checkSelector: ['div[class^="SellerInfo__info"]'],
        blacklist: ['Pravna osoba']
    }
};

function getSiteConfig() {
    const url = window.location.hostname;
    if (url.includes('njuskalo.hr')) return config.njuskalo;
    if (url.includes('oglasnik.hr')) return config.oglasnik;
    if (url.includes('index.hr')) return config.indexOglasi;
    return null;
}

/**
 *
 * @param {string} url
 * @param {string} selector
 * @param {string[]} blacklist
 * @returns {Promise<boolean>}
 */
async function fetchAndCheck(url, selector, blacklist) {
    try {
        const hostname = window.location.hostname;

        if (hostname.includes('index.hr')) {
            const adCodeMatch = url.match(/code=(\d+)/) || url.match(/\/(\d+)(\/|$)/);
            const adCode = adCodeMatch ? adCodeMatch[1] : null;

            if (!adCode) {
                console.warn('Could not extract ad code from URL:', url);
                return false;
            }

            const apiUrl = `https://www.index.hr/oglasi/api/aditem/single-ad?code=${adCode}&format=1`;
            const res = await fetch(apiUrl);
            const result = await res.json();

            const legalEntity = result?.data?.[0].legalEntity;

            if (legalEntity === 2) {
                console.log(`Ad ${adCode} is a "Pravna osoba". Hiding.`);
                return true;
            }

            return false;
        }

        // Fallback to regular DOM parsing for other sites
        const res = await fetch(url);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const elements = doc.querySelectorAll(selector);

        for (const el of elements) {
            const elHref = el.href?.toLowerCase() || '';
            const elText = el.textContent?.toLowerCase() || '';

            for (const word of blacklist) {
                const lowerWord = word.toLowerCase();
                if (elHref.includes(lowerWord) || elText.includes(lowerWord)) {
                    console.log(`Matched word "${word}" in element:`, el);
                    return true;
                }
            }
        }

        return false;
    } catch (e) {
        console.error('Error fetching:', url, e);
        return false;
    }
}


function loadInIframe(url) {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);

        iframe.onload = () => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                resolve(doc);
            } catch (e) {
                reject(e);
            }
        };

        setTimeout(() => reject('Timeout'), 10000); // Fallback in case iframe never loads
    });
}

async function processAds() {
    const siteConfig = getSiteConfig();
    if (!siteConfig) return;

    const list = document.querySelector(siteConfig.listSelector);
    if (!list) return;

    const items = list.querySelectorAll(siteConfig.itemSelector);

    for (const item of items) {
        let link;
        if (siteConfig.hrefAttribute) {
            link = item.getAttribute(siteConfig.hrefAttribute);
        } else if (siteConfig.hrefSelector) {
            const a = item.querySelector(siteConfig.hrefSelector);
            link = a?.href;
        }

        if (link && !link.startsWith('http')) {
            link = new URL(link, window.location.origin).href;
        }

        if (!link) continue;

        siteConfig.checkSelector.forEach(async (selector) => {
            const isBlacklisted = await fetchAndCheck(link, selector, siteConfig.blacklist);

            if (isBlacklisted) {
                item.style.display = 'none';
            }
        });

    }
}

window.addEventListener('load', () => {
    setTimeout(processAds, 2000); // slight delay to allow dynamic content loading
    setInterval(processAds, 10000);
});
