document.getElementsByClassName("cookie-box")[0].innerHTML = "<p>cookie policy...</p><input type=\"checkbox\" id=\"embeds\" name=\"thirdPartyCookies\"><label for=\"vehicle1\"> Allow third party embedded content.</label><br><input type=\"checkbox\" id=\"analytics\" name=\"analytics\"><label for=\"vehicle2\"> Allow google analytics</label><br><br><div style=\"text-align:center;\"><button id=\"acceptSelBtn\">accept selected</button><br><button class=\"blue-btn\" id=\"acceptAllBtn\">accept all</button></div>";

var analytics = document.getElementById('analytics');
var embeds = document.getElementById('embeds');

var cookieOv = document.getElementsByClassName("cookie-overlay")[0];
var btn = document.getElementById("myBtn");
var allBtn = document.getElementById("acceptAllBtn");
var selBtn = document.getElementById("acceptSelBtn");

if ((localStorage.getItem("consent")) === null) {
    cookieOv.style.display = "block";
}
var divList = document.getElementsByClassName("embedded-container");

if (localStorage.getItem("embeds") == "false") {
    for (i = 0; i < divList.length; i++) {
        var source = divList[i].getElementsByTagName("a")[0].href;
		divList[i].getElementsByTagName("a")[0].target = "_blank";
        divList[i].getElementsByTagName("a")[0].innerHTML = source;
        divList[i].innerHTML = "😢Oh no you have disabled third party embedded content.😢<br>You can either enable embeds by clicking the \"modify consent\" button at the bottom of the page or you can click the link directly:<br>" + divList[i].innerHTML;
    }

    while (divList.length != 0) {
		var half = (parseFloat(divList[0].style.paddingBottom)/2).toString()+"%";
	divList[0].style.paddingBottom = half;
	divList[0].style.paddingTop = half;
        divList[0].setAttribute("class", "no-embed-4u");
    }
} else if(localStorage.getItem("embeds") == "true"){
    for (i = 0; i < divList.length; i++) {
        var source = divList[i].getElementsByTagName("a")[0].href;
        var site = source.charAt(12);
        if (site == "g") {
            divList[i].innerHTML = "<img loading=\"lazy\" src=\"" + source + "\">"
        } else if (site == "y") {
            divList[i].innerHTML = "<iframe src=\"" + source + "\" title=\"YouTube video player\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" allowfullscreen></iframe>"
        }
    }
}

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

btn.onclick = function() {
    cookieOv.style.display = "block";
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

    //analytics.checked = true;
    //embeds.checked = true;
    cookieOv.style.display = "none";
    location.reload();
    return false;
}