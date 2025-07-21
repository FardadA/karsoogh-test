function setLoadingState(isLoading) {
  const spinnerElement = document.getElementById('loading-spinner');
  if (spinnerElement) {
    spinnerElement.style.display = isLoading ? 'flex' : 'none';
  }
}

function fadeOutElement(el) {
  return new Promise(resolve => {
    el.classList.remove('fade-in');
    el.classList.add('fade-out');
    el.addEventListener('transitionend', function handler() {
      el.removeEventListener('transitionend', handler);
      resolve();
    });
  });
}

function fadeInElement(el) {
  el.classList.remove('fade-out');
  el.classList.add('fade-in');
}

function switchToSection(sectionId, title) {
  // Hide all sections
  document.querySelectorAll('main .content-section').forEach(sec => {
    sec.classList.remove('active');
  });

  // Show the target section
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // Update the page title
  const pageTitle = document.getElementById('page-title');
  if (pageTitle && title) {
    pageTitle.textContent = title;
  }
}

window.setLoadingState = setLoadingState;
window.fadeOutElement = fadeOutElement;
window.fadeInElement = fadeInElement;
window.switchToSection = switchToSection;
