const canvas = document.getElementById('timelineCanvas');
const ctx = canvas.getContext('2d');

const tracks = [];
const audioElements = [];
const trackPositions = [];
let draggingIndex = null;
let currentTime = 0;
let isPlaying = false;
let isPaused = false; 
let scrollOffset = 0;
const trackColors = []; 
const canvasWidth = 1500; // Ancho visible del canvas
const timelineDuration = 30; // Duración total del timeline (en segundos)
const totalWidth = 9000; // Ancho total del timeline (es mayor que el ancho del canvas)

canvas.width = canvasWidth; // Establecer el ancho visible del canvas
canvas.height = 900;

document.getElementById('addTrackButton').addEventListener('click', function() {
    const trackInput = document.getElementById('trackInput');
    const files = trackInput.files;

    if (files.length > 0 && tracks.length < 20) {
        const file = files[0];
        const trackName = file.name;

        const audio = new Audio(URL.createObjectURL(file));
        audioElements.push(audio);
        tracks.push(trackName);
        trackPositions.push(tracks.length * 150); // Separar las pistas en el timeline
        trackColors.push(getRandomColor());
        drawTimeline();
    } else if (tracks.length >= 20) {
        document.getElementById('message').textContent = 'No puedes agregar más de 20 pistas.';
    } else {
        alert('Por favor, selecciona un archivo de audio.');
    }

    trackInput.value = '';
});

document.getElementById('playAllButton').addEventListener('click', function() {
    if (!isPlaying && !isPaused) {
        isPlaying = true;
        currentTime = 0;
        scrollOffset = 0; // Reset scroll when starting
        playTracks();
    } else if (isPaused) {
        // Unpause and continue playback
        isPaused = false;
        playTracks();
    }
});

document.getElementById('pauseButton').addEventListener('click', function() {
    pauseTracks();
});

document.getElementById('restartButton').addEventListener('click', function() {
    resetTimeline();
    playTracks(); // Optionally restart the playback after resetting
});

function pauseTracks() {
    // Pause all audio elements and reset their current time
    audioElements.forEach(audio => {
        audio.pause();

    });
    isPlaying = false; // Set playing status to false
    isPaused = true;
    drawTimeline(); // Redraw the timeline to reflect the stopped state
}

function resetTimeline() {
    // Reset the time and scroll offset
    currentTime = 0;
    scrollOffset = 0;
    drawTimeline(); // Redraw the timeline at the beginning
}


function playTracks() {
    
    if (isPaused) return;
    
    // Verificar si todos los audios han terminado
    const allAudiosFinished = audioElements.every(audio => audio.currentTime >= audio.duration);

    if (allAudiosFinished) {
        // Si todos los audios han terminado, reiniciar al principio
        resetTimeline();
        return;
    }

    // Reproducir audios según la posición de tiempo
    audioElements.forEach((audio, index) => {
        const trackX = trackPositions[index];
        const startTime = (trackX / totalWidth) * timelineDuration;

        if (currentTime >= startTime && audio.paused) {
            audio.play();
        }
    });

    // Ajustar desplazamiento si la línea roja se acerca al final del canvas
    const indicatorX = (currentTime / timelineDuration) * totalWidth;
    const threshold = scrollOffset + canvasWidth * 0.7; // Desplazamiento al 70%

    if (indicatorX > threshold) {
        scrollOffset = Math.min(indicatorX - canvasWidth * 0.7, totalWidth - canvasWidth);
    }

    currentTime += 0.1; // Incrementar el tiempo
    drawTimeline();

    if (currentTime < timelineDuration) {
        requestAnimationFrame(playTracks);
    } else {
        isPlaying = false; // Desactivar reproducción cuando termine
    }
}

// Función para reiniciar el tiempo y los audios
function resetTimeline() {
    currentTime = 0;
    scrollOffset = 0;
    audioElements.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    drawTimeline(); // Redibujar el canvas al principio
}

// Evento de desplazamiento con la rueda del mouse
canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    scrollOffset += event.deltaY * 0.5;
    scrollOffset = Math.max(0, Math.min(scrollOffset, totalWidth - canvasWidth));
    drawTimeline();
});

canvas.addEventListener('mousedown', (event) => {
    const mouseX = event.offsetX + scrollOffset;
    const mouseY = event.offsetY;

    tracks.forEach((track, index) => {
        const y = index * 50 + 40;
        const width = 100;
        const height = 30;

        if (mouseX > trackPositions[index] && mouseX < trackPositions[index] + width && mouseY > y && mouseY < y + height) {
            draggingIndex = index;
        }
    });
});

canvas.addEventListener('mousemove', (event) => {
    if (draggingIndex !== null) {
        const mouseX = event.offsetX + scrollOffset;
        trackPositions[draggingIndex] = mouseX;
        drawTimeline();
    }
});

canvas.addEventListener('mouseup', () => {
    draggingIndex = null;
});

canvas.addEventListener('mouseleave', () => {
    draggingIndex = null;
});

// Event listener for the 'dragover' event to allow files to be dropped onto the canvas
canvas.addEventListener('dragover', (event) => {
    event.preventDefault(); // Prevent the default behavior (e.g., opening the file)
});

// Event listener for the 'drop' event when files are dropped onto the canvas
canvas.addEventListener('drop', (event) => {
    event.preventDefault(); // Prevent the default behavior
    const files = event.dataTransfer.files;

    // Loop through each dropped file
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('audio/')) {  // Check if the dropped file is an audio file
            const trackName = file.name;

            // Create a new audio element
            const audio = new Audio(URL.createObjectURL(file));
            audioElements.push(audio);
            tracks.push(trackName);
            trackPositions.push(tracks.length * 150); // Place each track with a little gap on the timeline
            trackColors.push(getRandomColor());

            // Draw the updated timeline with the new track
            drawTimeline();
        } else {
            alert('Por favor, selecciona un archivo de audio.');
        }
    }
});

// Event listener for the 'contextmenu' event to handle right-click (track delete)
canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault(); // Prevent the default context menu from appearing

    const mouseX = event.offsetX + scrollOffset; // Get the mouse X position considering the scroll offset
    const mouseY = event.offsetY;

    // Check if a track was right-clicked
    tracks.forEach((track, index) => {
        const y = index * 50 + 40;
        const width = 100;
        const height = 30;

        // Check if the mouse is within the bounds of the track
        if (mouseX > trackPositions[index] && mouseX < trackPositions[index] + width && mouseY > y && mouseY < y + height) {
            // Delete the track by removing it from all arrays
            tracks.splice(index, 1);
            audioElements[index].pause(); // Pause the audio if it is playing
            audioElements.splice(index, 1); // Remove the audio element
            trackPositions.splice(index, 1); // Remove the track position
            trackColors.splice(index, 1); // Remove the track color

            // Redraw the timeline after the deletion
            drawTimeline();
        }
    });
});


// Function to generate a random color in hexadecimal format
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function drawTimeline() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const trackHeight = 30;
    const padding = 10;

    // Draw vertical lines along the canvas
    const numDivisions = 90; // Number of vertical lines (e.g., 10 divisions)
    const divisionWidth = totalWidth / numDivisions;

    ctx.strokeStyle = '#ccc'; // Light gray color for the vertical lines
    for (let i = 1; i < numDivisions; i++) {
        const xPos = i * divisionWidth - scrollOffset; // Calculate x position based on the number of divisions
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, canvas.height);
        ctx.stroke();
    }

    // Draw the tracks with offset
    tracks.forEach((track, index) => {
        const y = index * (trackHeight + padding) + padding + 40;
        const x = trackPositions[index] - scrollOffset;

        // Get the track duration and calculate the length of the track
        const audio = audioElements[index];
        const trackDuration = audio.duration || 0; // Default to 0 if the duration is not available
        const trackLength = (trackDuration / timelineDuration) * totalWidth; // Proportional length of the track

        // Assign a random color to the track
        const trackColor = trackColors[index];

        // Draw the track rectangle with the random color
        ctx.fillStyle = trackColor;
        ctx.fillRect(x, y, trackLength, trackHeight);

        // Draw the track name text
        ctx.fillStyle = '#ccc';
        ctx.font = '15px Montserrat , sans-serif';
        ctx.fillText(track, x + 5, y + (trackHeight / 1.5));
    });

    // Draw the time indicator with scroll offset
    const indicatorX = (currentTime / timelineDuration) * totalWidth - scrollOffset;

    // Ensure the red line stays within canvas bounds
    ctx.strokeStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(indicatorX, 0);
    ctx.lineTo(indicatorX, canvas.height);
    ctx.stroke();
}
