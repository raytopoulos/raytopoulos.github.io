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
	//divList[i].querySelectorAll('iframe,img')[0]..width = 1080;
	//divList[i].querySelectorAll('iframe,img')[0].height = 1920;
	//divList[i].innerHTML = "<div style\"position: absolute;top: 0;width: 100%;height: 100%;display: flex;align-items: center;justify-content: center;\">Uh oh a problem occured you need to allow all cookies otherwise no content... 🙂<br><a href=\""+source+"\" target=\"_blank\">"+source+"</a></div>";
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