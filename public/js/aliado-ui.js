/**
 * Aliado UI Helpers v2.0 — Grupo Aliado Hub Tech LTDA
 * Utilitários para toasters, modais, alternância de senha e filtros tabulares
 */

window.AliadoUI = (function() {
  
  // Toast container singleton
  let toastContainer = null;
  function getToastContainer() {
    if (!toastContainer) {
      toastContainer = document.querySelector('.aliado-toast-container');
      if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'aliado-toast-container';
        document.body.appendChild(toastContainer);
      }
    }
    return toastContainer;
  }

  function showToast(message, type = 'info', duration = 3500) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = 'aliado-toast';

    let iconName = 'help-circle';
    let iconColor = 'var(--aliado-cyan)';
    if (type === 'success') {
      iconName = 'check-circle';
      iconColor = 'var(--status-success-text)';
    } else if (type === 'danger' || type === 'error') {
      iconName = 'shield';
      iconColor = 'var(--status-danger-text)';
    }

    const iconSvg = window.AliadoIcons ? AliadoIcons.get(iconName, { size: 18 }) : '•';
    toast.innerHTML = `
      <div style="color: ${iconColor}; display: flex; align-items: center;">${iconSvg}</div>
      <div style="flex: 1;">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  function togglePassword(inputId, triggerBtn) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';

    if (window.AliadoIcons) {
      triggerBtn.innerHTML = AliadoIcons.get(isPassword ? 'eye-off' : 'eye', { size: 18 });
    }
  }

  return {
    toast: showToast,
    togglePassword: togglePassword
  };
})();
