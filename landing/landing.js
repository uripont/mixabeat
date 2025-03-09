document.addEventListener("DOMContentLoaded", () => {
    const title = document.getElementById("title");
    title.style.opacity = "0";

    setTimeout(() => {
        title.style.transition = "opacity 1.5s ease-in-out";
        title.style.opacity = "1";
    }, 500);
});
