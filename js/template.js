// js/template.js - Template page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Template page loaded');
    setupFilters();
});

function setupFilters() {
    const searchInput = document.querySelector('.search-input');
    const genreFilter = document.querySelector('.genre-filter');
    const dimensionFilter = document.querySelector('.dimension-filter');
    
    searchInput.addEventListener('input', updateFilters);
    genreFilter.addEventListener('change', updateFilters);
    dimensionFilter.addEventListener('change', updateFilters);
}

function updateFilters() {
    const searchInput = document.querySelector('.search-input');
    const genreFilter = document.querySelector('.genre-filter');
    const dimensionFilter = document.querySelector('.dimension-filter');
    
    console.log('Filters updated:', {
        search: searchInput.value,
        genre: genreFilter.value,
        dimension: dimensionFilter.value
    });
    
    // Di sini nanti akan load template berdasarkan filter
    // Untuk sekarang hanya console log
}