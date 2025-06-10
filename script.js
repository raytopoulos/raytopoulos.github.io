//dots=null;
fetch('data.json')
  .then(response => response.json())
  .then(data => {
    const container = document.getElementById('image-container');
    // Βάλε τα dots
    //dots=data.dots;
    data.dots.forEach(dot => {
      const el = document.createElement('div');
      el.className = 'dot';
      el.style.display= "flex"
      el.style.position = 'absolute';
      el.style.left = dot.x;
      el.style.top = dot.y;
      el.setAttribute('data-text', dot.desc);
      el.onclick=function() {
        openPreview(dot.img,dot.text);
      }
      container.appendChild(el);
    });

    // Κάνε το container relative
    container.style.position = 'relative';
    
  });

  window.onclick = function(event) {
    if (event.target == document.getElementById('wrapper')) {
      close();
    }
  }

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      close();
    }
  });

  function close(){
    document.getElementById("wrapper").style.display="none";
    document.body.style.overflow="hidden";
  }

function openPreview(img, text) {
    document.getElementById("wrapper").style.display = "flex";
    document.body.style.overflow = "hidden";

    const popupText = document.getElementById("popupText");
    const gallery = document.getElementById("popupGallery");

    // Βάλε το κείμενο
    popupText.textContent = text || "";

    // Καθάρισε το gallery
    gallery.innerHTML = "";

    // Αν img είναι array, δείξε όλες τις φωτογραφίες
    if (Array.isArray(img)) {
        img.forEach(src => {
            const image = document.createElement("img");
            image.src = src;
            image.className = "popup-image";
            gallery.appendChild(image);
        });
    } else if (img) {
        const image = document.createElement("img");
        image.src = img;
        image.className = "popup-image";
        gallery.appendChild(image);
    }
}



  document.addEventListener('DOMContentLoaded', function() {
  // Επειδή τα dots δημιουργούνται δυναμικά, χρειάζεται μικρή καθυστέρηση ή να το βάλεις εδώ
  setTimeout(() => {
    document.querySelectorAll('.dot').forEach(dot => {
      dot.addEventListener('click', function(e) {
        // Αφαιρεί το active από όλες τις κουκίδες
        document.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
        // Προσθέτει το active μόνο σε αυτή που πατήθηκε
        this.classList.add('active');
        // Για να μην ανοίγει το preview αν δεν το θες, βάλε e.stopPropagation();
      });
    });
  }, 100);
});
