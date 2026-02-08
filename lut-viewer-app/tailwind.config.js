/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./index.html"
    ],
    theme: {
        extend: {
            colors: {
                background: "#0F0F0F",
                surface: "#1A1A1A",
                primary: "#3B82F6", // Blue-500
                glass: "rgba(255, 255, 255, 0.05)"
            },
            backdropBlur: {
                'xs': '2px',
            }
        },
    },
    plugins: [],
}
