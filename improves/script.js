/* const canvas = document.getElementById('timelineCanvas');
const ctx = canvas.getContext('2d');

const tracks = []; // Arreglo para almacenar las pistas
const audioElements = []; // Arreglo para almacenar los elementos de audio
const trackPositions = []; // Arreglo para almacenar las posiciones de inicio de cada pista
let draggingIndex = null; // Índice de la pista que se está arrastrando
let currentTime = 0; // Tiempo actual del indicador de tiempo
let isPlaying = false; // Bandera para saber si está reproduciendo

document.getElementById('addTrackButton').addEventListener('click', function() {
    const trackInput = document.getElementById('trackInput');
    const files = trackInput.files;

    if (files.length > 0 && tracks.length < 4) {
        const file = files[0]; // Obtener el primer archivo
        const trackName = file.name;

        // Crear un nuevo elemento de audio
        const audio = new Audio(URL.createObjectURL(file));
        audioElements.push(audio); // Almacenar el audio
        tracks.push(trackName); // Agregar la pista al arreglo
        trackPositions.push(0); // Inicializar la posición de la pista en 0
        drawTimeline(); // Redibujar el timeline
    } else if (tracks.length >= 4) {
        document.getElementById('message').textContent = 'No puedes agregar más de 4 pistas.';
    } else {
        alert('Por favor, selecciona un archivo de audio.');
    }

    trackInput.value = ''; // Limpiar el campo de entrada
});

document.getElementById('playAllButton').addEventListener('click', function() {
    if (!isPlaying) {
        isPlaying = true; // Marcar que la reproducción ha comenzado
        currentTime = 0; // Reiniciar el tiempo actual
        playTracks(); // Iniciar la función de reproducción
    }
});

function playTracks() {
    // Reproducir pistas según el tiempo actual
    audioElements.forEach((audio, index) => {
        // Comprobar si el indicador de tiempo está en la posición de la pista
        const indicatorX = currentTime * (canvas.width / 10); // Ajustar según la duración total (10 segundos)
        const trackX = trackPositions[index]; // Obtener la posición de la pista

        // Verificar si el indicador está sobre la pista
        if (indicatorX >= trackX && indicatorX < trackX + 100) {
            if (audio.paused) {
                audio.currentTime = 0; // Reiniciar el tiempo de la pista
                audio.play(); // Reproducir la pista
            }
        } else {
            if (!audio.paused) {
                audio.pause(); // Pausar la pista si el indicador está fuera de su rango
            }
        }
    });

    // Actualizar el indicador de tiempo
    currentTime += 0.1; // Incrementar el tiempo actual
    drawTimeline(); // Redibujar el timeline

    // Detener la reproducción al final del tiempo
    if (currentTime < 10) { // Cambia 10 por la duración máxima esperada de tus pistas
        requestAnimationFrame(playTracks); // Llamar a la función en el siguiente cuadro
    } else {
        isPlaying = false; // Marcar que la reproducción ha terminado
        audioElements.forEach(audio => {
            audio.pause(); // Pausar todas las pistas al finalizar
            audio.currentTime = 0; // Reiniciar el tiempo de las pistas
        });
    }
}

canvas.addEventListener('mousedown', (event) => {
    const mouseX = event.offsetX;
    const mouseY = event.offsetY;

    // Verificar si se hizo clic en una pista
    tracks.forEach((track, index) => {
        const y = index * 50 + 40; // Calcular la posición vertical de la pista
        const width = 100; // Ancho de la pista
        const height = 30; // Altura de la pista

        // Comprobar si se hizo clic en la pista
        if (mouseX > trackPositions[index] && mouseX < trackPositions[index] + width && mouseY > y && mouseY < y + height) {
            draggingIndex = index; // Guardar el índice de la pista que se está arrastrando
        }
    });
});

canvas.addEventListener('mousemove', (event) => {
    if (draggingIndex !== null) {
        const mouseX = event.offsetX;
        trackPositions[draggingIndex] = mouseX; // Actualizar la posición de la pista que se está arrastrando
        drawTimeline(); // Redibujar el timeline
    }
});

canvas.addEventListener('mouseup', () => {
    draggingIndex = null; // Reiniciar el índice al soltar el ratón
});

canvas.addEventListener('mouseleave', () => {
    draggingIndex = null; // Reiniciar el índice si el ratón sale del canvas
});

function drawTimeline() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const trackHeight = 30; // Altura de cada pista
    const padding = 10; // Espaciado entre las pistas
    const trackWidth = 100; // Ancho de cada pista
    const totalDuration = 10;

    for (let i = 0; i <= totalDuration; i++) {
        const x = (canvas.width / totalDuration) * i;
        ctx.strokeStyle = '#ddd'; // Color de la separación
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
        
        // Dibujar los números de los segundos
        ctx.fillStyle = '#333'; // Color del texto
        ctx.fillText(i, x + 2, 20); // Posicionar el número al principio de cada segundo
    }

    // Dibujar cada pista en el canvas
    tracks.forEach((track, index) => {
        const y = index * (trackHeight + padding) + padding + 40; // Calcular la posición vertical
        ctx.fillStyle = '#e7f3fe'; // Color de fondo de la pista
        ctx.fillRect(trackPositions[index], y, trackWidth, trackHeight); // Dibujar el rectángulo de la pista
        ctx.fillStyle = '#333'; // Color del texto
        ctx.fillText(track, trackPositions[index] + 5, y + (trackHeight / 1.5)); // Dibujar el nombre de la pista
    });

    // Dibujar el indicador de tiempo
    const indicatorX = currentTime * (canvas.width / 10); // Ajustar según la duración total (10 segundos)
    ctx.strokeStyle = 'red'; // Color de la línea de tiempo
    ctx.beginPath();
    ctx.moveTo(indicatorX, 0);
    ctx.lineTo(indicatorX, canvas.height);
    ctx.stroke();
}
 

 */


/* const canvas = document.getElementById('timelineCanvas');
const ctx = canvas.getContext('2d');

const tracks = [];
const audioElements = [];
const trackPositions = [];
let draggingIndex = null;
let currentTime = 0;
let isPlaying = false;
let scrollOffset = 0;
const canvasWidth = 600; // Ancho visible del canvas
const timelineDuration = 10; // Duración total en segundos
const totalWidth = 1200; // Ancho total del timeline (mayor que el ancho del canvas)

canvas.width = canvasWidth; // Establecer el ancho visible

document.getElementById('addTrackButton').addEventListener('click', function() {
    const trackInput = document.getElementById('trackInput');
    const files = trackInput.files;

    if (files.length > 0 && tracks.length < 4) {
        const file = files[0];
        const trackName = file.name;

        const audio = new Audio(URL.createObjectURL(file));
        audioElements.push(audio);
        tracks.push(trackName);
        trackPositions.push(tracks.length * 150); // Separar las pistas en el timeline
        drawTimeline();
    } else if (tracks.length >= 4) {
        document.getElementById('message').textContent = 'No puedes agregar más de 4 pistas.';
    } else {
        alert('Por favor, selecciona un archivo de audio.');
    }

    trackInput.value = '';
});

document.getElementById('playAllButton').addEventListener('click', function() {
    if (!isPlaying) {
        isPlaying = true;
        currentTime = 0;
        scrollOffset = 0; // Reiniciar el desplazamiento al comenzar
        playTracks();
    }
});

function playTracks() {
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

function drawTimeline() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const trackHeight = 30;
    const padding = 10;
    const trackWidth = 100;

    // Dibujar pistas con desplazamiento
    tracks.forEach((track, index) => {
        const y = index * (trackHeight + padding) + padding + 40;
        const x = trackPositions[index] - scrollOffset;
        ctx.fillStyle = '#e7f3fe';
        ctx.fillRect(x, y, trackWidth, trackHeight);
        ctx.fillStyle = '#333';
        ctx.fillText(track, x + 5, y + (trackHeight / 1.5));
    });

    // Dibujar el indicador de tiempo con desplazamiento
    const indicatorX = (currentTime / timelineDuration) * totalWidth - scrollOffset;

    // Asegurarse de que la línea roja se dibuje dentro de los límites del canvas
    ctx.strokeStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(indicatorX, 0);
    ctx.lineTo(indicatorX, canvas.height);
    ctx.stroke();
}
 */

const canvas = document.getElementById('timelineCanvas');
const ctx = canvas.getContext('2d');

const tracks = [];
const audioElements = [];
const trackPositions = [];
let draggingIndex = null;
let currentTime = 0;
let isPlaying = false;
let scrollOffset = 0;
const canvasWidth = 600; // Ancho visible del canvas
const timelineDuration = 10; // Duración total del timeline (en segundos)
const totalWidth = 1200; // Ancho total del timeline (es mayor que el ancho del canvas)

canvas.width = canvasWidth; // Establecer el ancho visible del canvas

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
        drawTimeline();
    } else if (tracks.length >= 20) {
        document.getElementById('message').textContent = 'No puedes agregar más de 4 pistas.';
    } else {
        alert('Por favor, selecciona un archivo de audio.');
    }

    trackInput.value = '';
});

document.getElementById('playAllButton').addEventListener('click', function() {
    if (!isPlaying) {
        isPlaying = true;
        currentTime = 0;
        scrollOffset = 0; // Reiniciar el desplazamiento al comenzar
        playTracks();
    }
});

function playTracks() {
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


function drawTimeline() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const trackHeight = 30;
    const padding = 10;

    // Dibujar las pistas con desplazamiento
    tracks.forEach((track, index) => {
        const y = index * (trackHeight + padding) + padding + 40;
        const x = trackPositions[index] - scrollOffset;

        // Obtener la duración del audio y calcular la longitud del rectángulo
        const audio = audioElements[index];
        const trackDuration = audio.duration || 0; // Duración del audio, default a 0 si no está disponible
        const trackLength = (trackDuration / timelineDuration) * totalWidth; // Longitud proporcional

        // Asegurarse de que el rectángulo cubra toda la duración del audio
        const trackStartTime = (trackPositions[index] / totalWidth) * timelineDuration;
        const trackEndTime = trackStartTime + trackDuration;

        // Dibujar el rectángulo que abarca toda la duración de la pista
        ctx.fillStyle = '#e7f3fe';
        ctx.fillRect(x, y, trackLength, trackHeight);
        ctx.fillStyle = '#333';
        ctx.fillText(track, x + 5, y + (trackHeight / 1.5));
    });

    // Dibujar el indicador de tiempo con desplazamiento
    const indicatorX = (currentTime / timelineDuration) * totalWidth - scrollOffset;

    // Asegurarse de que la línea roja se dibuje dentro de los límites del canvas
    ctx.strokeStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(indicatorX, 0);
    ctx.lineTo(indicatorX, canvas.height);
    ctx.stroke();
}

