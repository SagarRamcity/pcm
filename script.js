const actionButton = document.querySelector('#action-button');
const message = document.querySelector('#message');

actionButton.addEventListener('click', () => {
  message.textContent = 'Hello from your new page.';
  actionButton.textContent = 'Hello received';
});
