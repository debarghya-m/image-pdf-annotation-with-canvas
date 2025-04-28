const canvas = document.getElementById("imageCanvas");
const ctx = canvas.getContext("2d");
const wrapper = document.getElementById("canvasWrapper");
const tooltip = document.getElementById("tooltip");
const saveBtn = document.getElementById("saveBtn");
const listContainer = document.getElementById("imageList");

let image = new Image();
let comments = [];
let currentId = null;
const MAX_WIDTH = 600;
let scale = 1;

const canvasContainer = document.getElementById('canvasContainer');
const markersLayer = document.getElementById('markersLayer');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');

const ZOOM_STEP = 0.1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
let visualScale = 1;

// Function to move all markers based on zoom
function repositionMarkers() {
  markersLayer.querySelectorAll(".marker").forEach((marker) => {
    const x = parseFloat(marker.dataset.x);
    const y = parseFloat(marker.dataset.y);
    marker.style.left = `${x * visualScale}px`;
    marker.style.top = `${y * visualScale}px`;
  });
}

// Function to apply zoom
function applyZoom(newScale) {
  visualScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
  canvasContainer.style.transform = `scale(${visualScale})`;
  repositionMarkers();
}

// Button click handlers
zoomInBtn.addEventListener('click', () => {
  applyZoom(visualScale + ZOOM_STEP);
});

zoomOutBtn.addEventListener('click', () => {
  applyZoom(visualScale - ZOOM_STEP);
});

function resetZoom() {
  visualScale = 1;
  canvasContainer.style.transform = `scale(${visualScale})`;
  repositionMarkers(); // reposition pins correctly at 1x zoom
}



function drawImage(imgSrc, callback) {
  image.onload = () => {
    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;

    scale = originalWidth > MAX_WIDTH ? MAX_WIDTH / originalWidth : 1;

    const displayWidth = originalWidth * scale;
    const displayHeight = originalHeight * scale;

    canvas.width = displayWidth;
    canvas.height = displayHeight;
    wrapper.style.width = `${displayWidth}px`;
    wrapper.style.height = `${displayHeight}px`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, displayWidth, displayHeight);

    if (callback) callback();
  };
  image.src = imgSrc;
}


function addMarker({ x, y, text }) {
  const marker = document.createElement("div");
  marker.className = "marker";

  // Store logical position (not scaled)
  marker.dataset.x = x;
  marker.dataset.y = y;

  marker.style.position = "absolute";
  marker.style.left = `${x * visualScale}px`;
  marker.style.top = `${y * visualScale}px`;
  marker.style.width = "15px";
  marker.style.height = "15px";
  marker.style.background = "#5F44CE";
  marker.style.borderRadius = "50%";
  marker.style.cursor = "pointer";
  marker.style.pointerEvents = "auto"; // Needed for hover

  marker.addEventListener("mouseenter", () => {
    tooltip.textContent = text;
    tooltip.style.display = "block";
    tooltip.style.left = `${x * visualScale + 15}px`;
    tooltip.style.top = `${y * visualScale + 15}px`;
  });

  marker.addEventListener("mouseleave", () => {
    tooltip.style.display = "none";
  });

  markersLayer.appendChild(marker);
}



function getStoredData() {
  return JSON.parse(localStorage.getItem("imagesWithComments") || "[]");
}

function setStoredData(data) {
  localStorage.setItem("imagesWithComments", JSON.stringify(data));
}

function updateList() {
  const data = getStoredData();
  listContainer.innerHTML = "";
  data.forEach((item, index) => {
    const entry = document.createElement("div");
    entry.textContent = `Image ${index + 1} (${item.comments.length} comments)`;
    entry.className = "list-item";
    entry.style.cursor = "pointer";
    entry.addEventListener("click", () => {
      currentId = index;
      drawImage(item.imgSrc, () => {
        comments = item.comments;
        wrapper.querySelectorAll(".marker").forEach((m) => m.remove());
        comments.forEach(addMarker);
        resetZoom();
      });
    });
    listContainer.appendChild(entry);
  });
}

function saveToLocal(imgSrc, comments) {
  const data = getStoredData();

  if (currentId !== null) {
    // We're editing an existing image
    data[currentId] = { imgSrc, comments };
  } else {
    // We're adding a new image
    data.push({ imgSrc, comments });
  }

  setStoredData(data);
  updateList();
  currentId = null;
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  wrapper.querySelectorAll(".marker").forEach((m) => m.remove());
  canvas.width = canvas.height = 0;
  wrapper.style.width = wrapper.style.height = "auto";
  comments = [];
  currentId = null;
}

canvas.addEventListener("click", (e) => {
  if (!image.src) return;

  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / (scale * visualScale);
  const y = (e.clientY - rect.top) / (scale * visualScale);

  const text = prompt("Enter your comment:");
  if (text) {
    const comment = { x, y, text };
    comments.push(comment);
    addMarker(comment);
  }
});



document.getElementById("imageUpload").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.type === "application/pdf") {
    const fileReader = new FileReader();
    fileReader.onload = function () {
      const typedarray = new Uint8Array(this.result);

      pdfjsLib.getDocument(typedarray).promise.then((pdf) => {
        pdf.getPage(1).then((page) => {
          const viewport = page.getViewport({ scale: 1 });
          const outputScale = MAX_WIDTH / viewport.width;
          const scaledViewport = page.getViewport({ scale: outputScale });

          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          wrapper.style.width = `${scaledViewport.width}px`;
          wrapper.style.height = `${scaledViewport.height}px`;

          const renderContext = {
            canvasContext: ctx,
            viewport: scaledViewport,
          };
          page.render(renderContext).promise.then(() => {
            image.src = canvas.toDataURL(); // Optional: Keep for later use
            comments = [];
            wrapper.querySelectorAll(".marker").forEach((m) => m.remove());
            resetZoom();
          });
        });
      });
    };
    fileReader.readAsArrayBuffer(file);
  } else {
    const reader = new FileReader();
    reader.onload = (evt) => {
      drawImage(evt.target.result, () => {
        comments = [];
        wrapper.querySelectorAll(".marker").forEach((m) => m.remove());
        resetZoom();
      });
    };
    reader.readAsDataURL(file);
  }
});



saveBtn.addEventListener("click", () => {
  if (image.src && comments.length) {
    saveToLocal(image.src, comments);
    clearCanvas();
    resetZoom(); // reset zoom when clearing
  } else {
    alert("Please upload an image and add at least one comment before saving.");
  }
});




updateList();
