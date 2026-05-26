(() => {
  const links = document.querySelectorAll('.find-courts-link');
  const search = document.getElementById('courtSearch');
  if (!links.length || !search) return;

  function scrollToSearch(event) {
    event.preventDefault();
    const rect = search.getBoundingClientRect();
    const desiredTop = window.innerWidth <= 720 ? window.innerHeight * 0.34 : window.innerHeight * 0.42;
    const targetY = window.scrollY + rect.top - desiredTop;
    window.history.replaceState(null, '', '#courtSearch');
    window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
  }

  links.forEach((link) => link.addEventListener('click', scrollToSearch));
})();
