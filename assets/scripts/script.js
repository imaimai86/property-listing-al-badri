// Make initHeader globally available for the component loader
window.initHeader = function() {
    // Header Scroll Effect
    const header = document.getElementById('header');
    if (!header) return; // Guard clause if header not yet loaded

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Mobile Menu Toggle
    const menuIcon = document.querySelector('.mobile-menu-icon');
    const nav = document.querySelector('.nav');

    if (menuIcon && nav) {
        // Clone and replace to remove old listeners
        const newMenuIcon = menuIcon.cloneNode(true);
        menuIcon.parentNode.replaceChild(newMenuIcon, menuIcon);
        
        newMenuIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            nav.classList.toggle('open');
            const icon = nav.classList.contains('open') ? 'close-outline' : 'menu-outline';
            newMenuIcon.querySelector('ion-icon').setAttribute('name', icon);
        });
    }

    // Helper function to close mobile menu
    const closeMobileMenu = () => {
        const navEl = document.querySelector('.nav');
        const menuIconEl = document.querySelector('.mobile-menu-icon');
        if (navEl && navEl.classList.contains('open')) {
            navEl.classList.remove('open');
            if (menuIconEl) {
                const icon = menuIconEl.querySelector('ion-icon');
                if (icon) icon.setAttribute('name', 'menu-outline');
            }
        }
        // Also close any open dropdowns
        document.querySelectorAll('.dropdown-menu.active').forEach(dropdown => {
            dropdown.classList.remove('active');
        });
    };

    // Mobile Dropdown Toggle - only for the chevron icon
    const dropdowns = document.querySelectorAll('.nav-item');
    dropdowns.forEach(item => {
        const link = item.querySelector('.nav-link');
        const menu = item.querySelector('.dropdown-menu');
        
        if (menu && link) {
            // Clone link to remove old listeners
            const newLink = link.cloneNode(true);
            link.parentNode.replaceChild(newLink, link);
            
            // Only handle chevron click for dropdown toggle
            const chevron = newLink.querySelector('ion-icon');
            if (chevron) {
                chevron.addEventListener('click', (e) => {
                    if (window.innerWidth <= 768) {
                        e.preventDefault();
                        e.stopPropagation();
                        menu.classList.toggle('active');
                        chevron.style.transform = menu.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0)';
                        chevron.style.transition = 'transform 0.3s ease';
                    }
                });
            }
        }
    });

    // Handle dropdown item clicks - these should always navigate
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't prevent default - let it navigate
            closeMobileMenu();
        });
    });

    // Handle all navigation links that should close the menu
    document.querySelectorAll('.nav-link:not([data-dropdown-toggle])').forEach(link => {
        // Skip if this link has a dropdown (main toggle)
        const parentItem = link.closest('.nav-item');
        const hasDropdown = parentItem && parentItem.querySelector('.dropdown-menu');
        
        if (!hasDropdown) {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    closeMobileMenu();
                }
            });
        }
    });

    // Smooth Scrolling for Hash Anchors
    document.querySelectorAll('a[href^="#"], a[href*="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            
            // Skip if no href or just "#"
            if (!href || href === '#') {
                e.preventDefault();
                return;
            }
            
            // Extract the hash part (handles both "#section" and "page.html#section")
            const hashIndex = href.indexOf('#');
            if (hashIndex === -1) return; // No hash, let browser handle
            
            const targetId = href.substring(hashIndex);
            if (!targetId || targetId === '#') return;
            
            // Check if this is a same-page link or cross-page link
            const hrefPage = href.substring(0, hashIndex);
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            
            // If linking to a different page, let browser handle it
            if (hrefPage && !hrefPage.endsWith(currentPage) && hrefPage !== '' && hrefPage !== './') {
                closeMobileMenu();
                return; // Let browser navigate to new page
            }
            
            // Same page - do smooth scroll
            e.preventDefault();
            closeMobileMenu();
            
            try {
                const targetElement = document.querySelector(targetId);

                if (targetElement) {
                    // Get current header height
                    const headerHeight = document.querySelector('.header')?.classList.contains('scrolled') ? 80 : 100;
                    
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                    
                    // Update URL without triggering navigation
                    history.pushState(null, '', targetId);
                }
            } catch (err) {
                console.warn('Smooth scroll invalid target:', targetId);
            }
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        const navEl = document.querySelector('.nav');
        const menuIconEl = document.querySelector('.mobile-menu-icon');
        
        if (navEl && navEl.classList.contains('open')) {
            // Check if click is outside nav and menu icon
            if (!navEl.contains(e.target) && !menuIconEl?.contains(e.target)) {
                closeMobileMenu();
            }
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    // Attempt init in case header is static (legacy)
    window.initHeader();

    // Simple fade-in animation on scroll
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.about-card, .gallery-item, .contact-wrapper');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Load Featured Properties immediately with slight delay
    const featuredContainer = document.getElementById('featured-properties');
    if (featuredContainer) {
        // Add a slight delay for better UX
        setTimeout(() => {
            const dataSource = CONFIG.APPS_SCRIPT_URL_LISTINGS;
            fetch(dataSource)
                .then(res => res.json())
                .then(data => {
                    const featured = data.filter(p => p.featured === true).slice(0, 4);
                    featuredContainer.innerHTML = '';

                    featured.forEach(p => {
                        const item = document.createElement('a'); // Changed to <a>
                        // Simple slug creation
                        const slug = p.title.toLowerCase()
                            .replace(/[^\w\s-]/g, '')
                            .replace(/[\s_-]+/g, '-')
                            .replace(/^-+|-+$/g, '');
                            
                        item.href = `property-details.html?id=${p.id}&slug=${slug}`; // Add link
                        item.style.display = "block";
                        item.className = 'gallery-item';
                        const rawImg = p.image || p.thumbnail;
                        let imgUrl = rawImg;
                        if (rawImg && !rawImg.startsWith('http')) {
                            const baseUrl = CONFIG.S3_BASE_URL.endsWith('/') ? CONFIG.S3_BASE_URL : CONFIG.S3_BASE_URL + '/';
                            const path = rawImg.startsWith('/') ? rawImg.substring(1) : rawImg;
                            imgUrl = baseUrl + path;
                        }

                        item.innerHTML = `
                            <img src="${imgUrl}" alt="${p.title}" class="gallery-img-real">
                            <div class="gallery-info">
                                <h4>${p.title}</h4>
                                <p>${p.location}</p>
                            </div>
                        `;
                        // Add scroll animation to dynamic items
                        item.style.opacity = '0';
                        item.style.transform = 'translateY(20px)';
                        item.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                        observer.observe(item);
                        
                        featuredContainer.appendChild(item);
                    });
                })
                .catch(err => {
                    console.error('Error loading featured properties:', err);
                    featuredContainer.innerHTML = '<p>Error loading properties.</p>';
                });
        }, 300); // 300ms delay for better UX
    }

    // Homepage Contact Form Submission Logic
    const homeContactForm = document.getElementById('home-contact-form');
    const homeFormStatus = document.getElementById('home-form-status');
    const homeSubmitButton = homeContactForm ? homeContactForm.querySelector('button[type="submit"]') : null;

    if (homeContactForm) {
        homeContactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = {
                // Use placeholders for propId and propTitle as this is a general inquiry
                propId: 'general-inquiry',
                propTitle: 'General Inquiry',
                name: document.getElementById('home-user-name').value,
                email: document.getElementById('home-user-email').value,
                contactNumber: document.getElementById('home-user-phone').value,
                message: document.getElementById('home-user-message').value
            };

            // Use the common contact form submission function
            submitContactForm(formData, homeFormStatus, homeSubmitButton, homeContactForm, () => {
                // Auto-hide success message after 5 seconds for homepage form
                setTimeout(() => {
                    homeFormStatus.style.display = 'none';
                }, 5000);
            });
        });
    }
});
