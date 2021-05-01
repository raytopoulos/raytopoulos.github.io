const analytics = document.getElementById('analytics');
const embeds = document.getElementById('embeds');

var cookies = document.getElementById("cookies");
var btn = document.getElementById("myBtn");
var allBtn = document.getElementById("acceptAllBtn");
var selBtn = document.getElementById("acceptSelBtn");

if ((localStorage.getItem("consent")) === null) {
  cookies.style.display = "block";
}
if(localStorage.getItem("embeds")=="false"||localStorage.getItem("embeds")===null){
	var divList = document.getElementsByClassName("embedded-container");
for(i=0;i<divList.length;i++){
	var source = divList[i].querySelectorAll('iframe,img')[0].src;
	//var source = "test";
	divList[i].innerHTML = "😢Oh no you have disabled third party embedded content😢<br>don't worry here's the link:<br><a href=\""+source+"\" target=\"_blank\">"+source+"</a>";
}

while(divList.length!=0){
	//alert(divList.length);
	divList[0].setAttribute("class", "no-embed-4u");
}

}

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