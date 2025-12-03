// js/prompting.js - Prompting page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Prompting page loaded');
    setupPrompting();
});

function setupPrompting() {
    const generateBtn = document.querySelector('.generate-btn');
    const promptInput = document.querySelector('.prompt-input');
    
    generateBtn.addEventListener('click', generateGame);
    
    // Auto-resize textarea
    promptInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

function generateGame() {
    const promptInput = document.querySelector('.prompt-input');
    const languageSelect = document.querySelector('.language-dropdown');
    const generateBtn = document.querySelector('.generate-btn');
    
    const prompt = promptInput.value.trim();
    const language = languageSelect.value;
    
    if (prompt === '') {
        alert('Please enter a game prompt!');
        return;
    }
    
    // Simulate AI processing
    generateBtn.textContent = 'Generating...';
    generateBtn.disabled = true;
    
    // Simulate API call to Gemini AI
    setTimeout(() => {
        alert('Game generated successfully! (Demo mode)');
        generateBtn.textContent = 'Generate Game';
        generateBtn.disabled = false;
        
        // Reset form
        promptInput.value = '';
        promptInput.style.height = 'auto';
    }, 2000);
}