// Footer year
const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

// Mobile menu
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");
if (toggle) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
    links.querySelectorAll("a").forEach(a =>
        a.addEventListener("click", () => links.classList.remove("open"))
    );
}

// Pixel starfield background
const canvas = document.getElementById("starfield");
const ctx = canvas.getContext("2d");
const colors = ["#EAECF0", "#EAECF0", "#EAECF0", "#9DB0BD", "#FE7F2D"];
let stars = [];

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: 180 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() < 0.85 ? 1 : 2,
        speed: 0.05 + Math.random() * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)]
    }));
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
        ctx.fillStyle = s.color;
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
        s.y += s.speed;
        if (s.y > canvas.height) s.y = 0;
    }
    requestAnimationFrame(draw);
}

window.addEventListener("resize", resize);
resize();

// Draw one still frame if the visitor prefers reduced motion
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    for (const s of stars) {
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x, s.y, s.size, s.size);
    }
} else {
    draw();
}
