const analytics = document.getElementById('analytics');
const embeds = document.getElementById('embeds');

var cookies = document.getElementById("cookies");
var btn = document.getElementById("myBtn");
var allBtn = document.getElementById("acceptAllBtn");
var selBtn = document.getElementById("acceptSelBtn");

if ((localStorage.getItem("consent")) == "true") {
  cookies.style.display = "none";
}
if(localStorage.getItem("embeds")=="false"||localStorage.getItem("embeds")===null){
var list = document.getElementsByTagName("iframe");
for (i = 0; i < list.length; i++) {
list[i].src = "_";
list[i].style.display = "none";
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