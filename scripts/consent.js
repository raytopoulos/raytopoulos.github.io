const analytics = document.getElementById('analytics');
const embeds = document.getElementById('embeds');

var cookies = document.getElementById("cookies");
var btn = document.getElementById("myBtn");
var allBtn = document.getElementById("acceptAllBtn");
var selBtn = document.getElementById("acceptSelBtn");

if ((localStorage.getItem("consent")) === null) {
  cookies.style.display = "block";
}
var divList = document.getElementsByClassName("embedded-container");
if(divList!=null){
	//alert("aaaaaaaa");
	
}
if(localStorage.getItem("embeds")=="false"||localStorage.getItem("embeds")===null){
for(i=0;i<divList.length;i++){
	var source = divList[i].getElementsByTagName("a")[0].href;
	divList[i].getElementsByTagName("a")[0].innerHTML=source;
	divList[i].innerHTML = "😢Oh no you have disabled third party embedded content😢<br>don't worry here's the link:<br>"+divList[i].innerHTML;
}

while(divList.length!=0){
	//alert(divList.length);
	divList[0].setAttribute("class", "no-embed-4u");
}
}else{
	for(i=0;i<divList.length;i++){
		var source = divList[i].getElementsByTagName("a")[0].href;
		var site = source.charAt(12);
		if(site=="g"){
			divList[i].innerHTML = "<img loading=\"lazy\" src=\""+source+"\">"
		}else if(site=="y"){
			divList[i].innerHTML = "<iframe src=\""+source+"\" title=\"YouTube video player\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\" allowfullscreen></iframe>"
		}
	}
}
//var html = document.getElementsByTagName("head")[0].innerHTML;
var str = "<script async src=\"https://www.googletagmanager.com/gtag/js?id=UA-166964258-2\"></script><script>window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'UA-166964258-2');</script>";
//document.getElementById('head').insertAdjacentHTML( 'afterbegin', str );

document.write(str);

btn.onclick = function() {
  cookies.style.display = "block";
}

selBtn.onclick = function() {
	cookies.style.display = "none";
	localStorage.setItem('embeds', embeds.checked);
	localStorage.setItem('analytics', analytics.checked);
	localStorage.setItem('consent', true);
	cookies.style.display = "none";
	location.reload();
	return false;
}

allBtn.onclick = function() {
	localStorage.setItem('embeds', true);
	localStorage.setItem('analytics', true);
	localStorage.setItem('consent', true);
	
	//analytics.checked = true;
	//embeds.checked = true;
	cookies.style.display = "none";
	location.reload();
	return false;
}