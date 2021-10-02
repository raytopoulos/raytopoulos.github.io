var cookieText = "<p>This site uses google analytics to measure traffic and optimize content accordingly. Google analytics uses cookies under this site's domain name so they can be deleted automatically. <br>If you uncheck the option \"allow google analytics\" any prior cookies related to analytics will be deleted and analytics will not load next time you visit.<br><br>In addition this site may use third parties such as youtube and google photos to enhance user experiance. Cookies used by third parties cannot be accessed by the site thus they cannot be deleted automatically.<br> If you uncheck the option \"allow third party embedded content\" then third party embeds (i.e. youtube videos) will not load next time you visit but you will have to manually delete any browsing data used by third parties.<br><br>You can modify your selection at any moment by clicking the \"modify consent\" button at the bottom of the page.<br>For more information about the data this site collects read the <a style = \"color:#6288e0;\" href=\"../privacy-policy\">privacy policy.</a></p>";
document.getElementsByClassName("cookie-box")[0].innerHTML = "<h3 style=\"text-align:center;\">About cookies</h3>"+cookieText+"<input type=\"checkbox\" id=\"analytics\" name=\"analytics\"><label for=\"vehicle2\"> Allow google analytics</label><br><input type=\"checkbox\" id=\"embeds\" name=\"thirdPartyCookies\" checked><label for=\"vehicle1\"> Allow third party embedded content.</label><br><br><div style=\"text-align:center;\"><button id=\"acceptSelBtn\">accept selection</button><br><button class=\"blue-btn\" id=\"acceptAllBtn\">accept all</button></div>";

const cookieOv = document.getElementsByClassName("cookie-overlay")[0];
const analytics = document.getElementById('analytics');
const embeds = document.getElementById('embeds');
const allBtn = document.getElementById("acceptAllBtn");
const selBtn = document.getElementById("acceptSelBtn");
const btn = document.getElementById("myBtn");

if ((localStorage.getItem("consent")) === null) {
    cookieOv.style.display = "block";
}

manageThirdPartyEmbeds();
injectAnalytics();

function manageThirdPartyEmbeds() {
    var divList = document.getElementsByClassName("embedded-container");

    if (localStorage.getItem("embeds") == "false") {
        for (i = 0; i < divList.length; i++) {
            var source = divList[i].getElementsByTagName("a")[0].href;
            divList[i].getElementsByTagName("a")[0].target = "_blank";
            divList[i].getElementsByTagName("a")[0].innerHTML = source;
            divList[i].innerHTML = "😢Oh no you have disabled third party embedded content.😢<br>You can either enable embeds by clicking the \"modify consent\" button at the bottom of the page or you can click the link directly:<br>" + divList[i].innerHTML;
        }

        while (divList.length != 0) {
            var half = (parseFloat(divList[0].style.paddingBottom) / 2).toString() + "%";
            divList[0].style.paddingBottom = half;
            divList[0].style.paddingTop = half;
            divList[0].setAttribute("class", "no-embed-4u");
        }
    } else if (localStorage.getItem("embeds") == "true") {
        for (i = 0; i < divList.length; i++) {
            var source = divList[i].getElementsByTagName("a")[0].href;
            var site = source.charAt(12);
            if (site == "y") {
				divList[i].innerHTML = "<iframe src=\"" + source + "\" title=\"YouTube video player\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" allowfullscreen></iframe>"
            } else {
                divList[i].innerHTML = "<img loading=\"lazy\" src=\"" + source + "\">"
			}
        }
    }
}

function injectAnalytics() {
    if (localStorage.getItem("analytics") == "true") {
        var scr1 = document.createElement("script");
        var scr2 = document.createElement("script");
        scr1.src = "https://www.googletagmanager.com/gtag/js?id=UA-166964258-2";
        scr1.async = true;
        scr2.innerHTML = "window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'UA-166964258-2');";
        var scrFirst = document.getElementsByTagName('script')[0];
        scrFirst.parentNode.insertBefore(scr1, scrFirst);
        scrFirst.parentNode.insertBefore(scr2, scrFirst);
    }
}

btn.onclick = function() {
    cookieOv.style.display = "block";
    analytics.checked = (localStorage.getItem("analytics") == "true");
    embeds.checked = (localStorage.getItem("embeds") == "true");
}

selBtn.onclick = function() {
    localStorage.setItem('embeds', embeds.checked);
    localStorage.setItem('analytics', analytics.checked);
    localStorage.setItem('consent', true);

    cookieOv.style.display = "none";

    location.reload();
    return false;
}

allBtn.onclick = function() {
    localStorage.setItem('embeds', true);
    localStorage.setItem('analytics', true);
    localStorage.setItem('consent', true);

    cookieOv.style.display = "none";

    location.reload();
    return false;
}