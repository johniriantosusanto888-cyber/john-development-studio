document.addEventListener('DOMContentLoaded', function() {
  const appCards = document.querySelectorAll('.app-card');
  
  appCards.forEach((card, index) => {
    setTimeout(() => {
      card.classList.add('visible');
    }, index * 50);
  });
});
