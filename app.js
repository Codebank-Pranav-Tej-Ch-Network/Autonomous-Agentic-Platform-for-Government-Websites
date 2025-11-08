/*
  This file contains all the JavaScript logic.
  It is loaded at the end of the <body> in index.html.
*/

// --- FIX: Wait for the entire HTML document to load before running any JS ---
document.addEventListener('DOMContentLoaded', () => {

    // --- API Configuration ---
    const API_URL = 'http://localhost:3000/api';
    let currentUserData = null;

    // --- Get DOM Elements (Modal) ---
    const modal = document.getElementById('eIdModal');
    const openModalSearchButton = document.getElementById('openModalSearchButton');
    const openModalRegisterButton = document.getElementById('openModalRegisterButton');
    const mainRegisterButton = document.getElementById('mainRegisterButton');
    const closeModalButton = document.getElementById('closeModalButton');

    // Views
    const searchView = document.getElementById('searchView');
    const registerView = document.getElementById('registerView');
    // Tabs
    const tabSearch = document.getElementById('tabSearch');
    const tabRegister = document.getElementById('tabRegister');
    // Search
    const searchInput = document.getElementById('eid-number');
    const searchButton = document.getElementById('searchButton');
    const downloadButton = document.getElementById('downloadButton');
    const resultsCard = document.getElementById('resultsCard');
    const errorBox = document.getElementById('errorBox');
    const errorMessage = document.getElementById('errorMessage');
    // Search Results Spans
    const resName = document.getElementById('res-name');
    const resDob = document.getElementById('res-dob');
    const resGender = document.getElementById('res-gender');
    const resPhone = document.getElementById('res-phone');
    const resAddress = document.getElementById('res-address');
    const resEid = document.getElementById('res-eid');
    const resIssued = document.getElementById('res-issued');
    // Register
    const registerForm = document.getElementById('registerForm');
    const registerButton = document.getElementById('registerButton');
    const successBox = document.getElementById('successBox');
    const newEIdNumber = document.getElementById('newEIdNumber');

    /**
     * Switches the visible view between 'search' and 'register'.
     * @param {string} viewName - 'search' or 'register'
     */
    function showView(viewName) {
        // Guard clauses to ensure elements exist before modifying
        if(searchView) searchView.classList.add('hidden');
        if(registerView) registerView.classList.add('hidden');
        if(resultsCard) resultsCard.classList.add('hidden');
        if(errorBox) errorBox.classList.add('hidden');
        if(successBox) successBox.classList.add('hidden');
        
        if(tabSearch) tabSearch.classList.remove('active');
        if(tabRegister) tabRegister.classList.remove('active');

        if (viewName === 'search' && searchView && tabSearch) {
            searchView.classList.remove('hidden');
            tabSearch.classList.add('active');
        } else if (viewName === 'register' && registerView && tabRegister) {
            registerView.classList.remove('hidden');
            tabRegister.classList.add('active');
        }
    }

    /**
     * Searches the database by making a FETCH request to the backend.
     */
    async function searchEId() {
        // Guard clause for essential search elements
        if (!searchInput || !errorMessage || !errorBox || !resultsCard || !searchButton) {
            console.error("Search UI elements are missing.");
            return;
        }
        
        const eIdToFind = searchInput.value.trim();
        if (eIdToFind.length !== 12 || !/^\d+$/.test(eIdToFind)) {
            errorMessage.textContent = 'Please enter a valid 12-digit E-ID number.';
            errorBox.classList.remove('hidden');
            resultsCard.classList.add('hidden');
            return;
        }

        try {
            searchButton.textContent = 'Searching...';
            searchButton.disabled = true;

            const response = await fetch(`${API_URL}/search/${eIdToFind}`);
            const result = await response.json(); // Get JSON body for both success and error

            if (!response.ok) {
                // Use the error message from the backend
                throw new Error(result.message || 'An unknown error occurred.');
            }

            const user = result; // If response.ok, result is the user
            currentUserData = user;

            // Fill results, checking if each span exists
            if(resName) resName.textContent = user.name;
            if(resDob) resDob.textContent = new Date(user.dob).toLocaleDateString('en-CA'); // Use YYYY-MM-DD format
            if(resGender) resGender.textContent = user.gender;
            if(resPhone) resPhone.textContent = user.phone;
            if(resAddress) resAddress.textContent = user.address;
            if(resEid) resEid.textContent = user.eId;
            if(resIssued) resIssued.textContent = new Date(user.issued).toLocaleDateString('en-CA');

            resultsCard.classList.remove('hidden');
            errorBox.classList.add('hidden');

        } catch (error) {
            currentUserData = null;
            resultsCard.classList.add('hidden');
            errorMessage.textContent = error.message; // Display the error message
            errorBox.classList.remove('hidden');
        } finally {
            searchButton.textContent = 'Search Record';
            searchButton.disabled = false;
        }
    }

    /**
     * Handles the new user registration by POSTing data to the backend.
     */
    async function handleRegistration(event) {
        event.preventDefault(); 
        
        // Guard clause for essential register elements
        if (!successBox || !errorBox || !errorMessage || !registerForm || !registerButton) {
             console.error("Register UI elements are missing.");
            return;
        }

        successBox.classList.add('hidden');
        errorBox.classList.add('hidden');

        // Get values from form fields
        const name = document.getElementById('reg-name')?.value;
        const dob = document.getElementById('reg-dob')?.value;
        const gender = document.getElementById('reg-gender')?.value;
        const phone = document.getElementById('reg-phone')?.value;
        const address = document.getElementById('reg-address')?.value;

        if (!name || !dob || !gender || !phone || !address) {
            errorMessage.textContent = "All fields are required for registration.";
            errorBox.classList.remove('hidden');
            return;
        }

        const registrationData = { name, dob, gender, phone, address };

        try {
            registerButton.textContent = 'Registering...';
            registerButton.disabled = true;

            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registrationData),
            });

            const result = await response.json(); // Get JSON for both success and error

            if (!response.ok) {
                // This will catch "User already registered" (409)
                throw new Error(result.message || 'Registration failed.');
            }

            // Success
            if(newEIdNumber) newEIdNumber.textContent = result.eId;
            successBox.classList.remove('hidden');
            registerForm.reset();

        } catch (error) {
            errorMessage.textContent = error.message; // Display the error (e.g., "User already registered")
            errorBox.classList.remove('hidden');
        } finally {
            registerButton.textContent = 'Register and Generate E-ID';
            registerButton.disabled = false;
        }
    }

    /**
     * Creates and triggers a download for a .txt file
     */
    function downloadTxt() {
        if (!currentUserData) {
            console.error("No user data to download.");
            return;
        }

        const textContent = `
E-ID IDENTITY CARD (ELECTRONIC RECORD)
=======================================
E-ID NUMBER: ${currentUserData.eId}
ISSUED ON:   ${new Date(currentUserData.issued).toLocaleDateString('en-US')}
NAME:        ${currentUserData.name}
DOB:         ${new Date(currentUserData.dob).toLocaleDateString('en-US')}
GENDER:      ${currentUserData.gender}
CONTACT:     ${currentUserData.phone}
ADDRESS:     ${currentUserData.address}
=======================================
*** This is a digitally generated document. ***
        `;

        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(textContent));
        element.setAttribute('download', `e-id-${currentUserData.eId}.txt`);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    // --- Event Listeners (Page & Modal) ---
    // ADDED "if (element)" GUARDS to all event listeners

    // Modal controls
    if (openModalSearchButton) {
        openModalSearchButton.addEventListener('click', () => {
            showView('search');
            if (modal) {
                modal.classList.remove('invisible', 'opacity-0');
                const wrapper = modal.querySelector('.modal-content-wrapper');
                if(wrapper) wrapper.classList.remove('scale-95');
            }
        });
    }

    if (openModalRegisterButton) {
        openModalRegisterButton.addEventListener('click', () => {
            showView('register');
            if (modal) {
                modal.classList.remove('invisible', 'opacity-0');
                const wrapper = modal.querySelector('.modal-content-wrapper');
                if(wrapper) wrapper.classList.remove('scale-95');
            }
        });
    }

    if (mainRegisterButton) {
        mainRegisterButton.addEventListener('click', (e) => {
            e.preventDefault();
            showView('register');
            if (modal) {
                modal.classList.remove('invisible', 'opacity-0');
                const wrapper = modal.querySelector('.modal-content-wrapper');
                if(wrapper) wrapper.classList.remove('scale-95');
            }
        });
    }

    if (closeModalButton) {
        closeModalButton.addEventListener('click', () => {
            if (modal) {
                modal.classList.add('invisible', 'opacity-0');
                const wrapper = modal.querySelector('.modal-content-wrapper');
                if(wrapper) wrapper.classList.add('scale-95');
            }
        });
    }

    // Tab Switching
    if (tabSearch) {
        tabSearch.addEventListener('click', () => showView('search'));
    }
    if (tabRegister) {
        tabRegister.addEventListener('click', () => showView('register'));
    }

    // Search View
    if (searchButton) {
        searchButton.addEventListener('click', searchEId);
    }
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchEId();
            }
        });
    }
    if (downloadButton) {
        downloadButton.addEventListener('click', downloadTxt);
    }

    // Register View
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegistration);
    }

    // --- Dropdown Menu Logic ---
    // This logic is already safe because querySelectorAll().forEach()
    // simply does nothing on an empty list, it doesn't crash.
    document.querySelectorAll('.dropdown-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const menu = button.nextElementSibling;
            if (menu) {
                const isHidden = menu.classList.contains('hidden');
                // Close all other menus
                document.querySelectorAll('.dropdown-menu').forEach(m => {
                    m.classList.add('hidden');
                });
                // Toggle the current one
                if (isHidden) {
                    menu.classList.remove('hidden');
                }
            }
        });
    });

    // Close dropdowns if clicking outside
    window.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown-toggle')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.classList.add('hidden');
            });
        }
    });

    // --- Carousel Logic ---
    const slides = document.querySelectorAll('.carousel-item');
    if (slides.length > 0) {
        let currentSlide = 0;
        const slideCount = slides.length;

        function showSlide(index) {
            slides.forEach((slide, i) => {
                slide.classList.toggle('active', i === index);
            });
        }

        function nextSlide() {
            currentSlide = (currentSlide + 1) % slideCount;
            showSlide(currentSlide);
        }

        setInterval(nextSlide, 5000);
        showSlide(currentSlide); // Show the first slide
    }

    // --- Initial Setup ---
    // Show the search view by default *inside the modal*
    showView('search');

})