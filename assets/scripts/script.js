// Make initHeader globally available for the component loader
window.initHeader = function() {
    // Header Scroll Effect
    const header = document.getElementById('header');
    if (!header) return; // Guard clause if header not yet loaded

    // Remove existing listener to prevent duplicates if called multiple times (simple approach)
    // In a more complex app we'd track the handler function reference.
    // For now, we assume this is called once per page load after injection.
    
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
        // Clone and replace to remove old listeners (brute force cleanup)
        const newMenuIcon = menuIcon.cloneNode(true);
        menuIcon.parentNode.replaceChild(newMenuIcon, menuIcon);
        
        newMenuIcon.addEventListener('click', () => {
            nav.classList.toggle('open');
            const icon = nav.classList.contains('open') ? 'close-outline' : 'menu-outline';
            newMenuIcon.querySelector('ion-icon').setAttribute('name', icon);
        });
    }

    // Mobile Dropdown Toggle
    const dropdowns = document.querySelectorAll('.nav-item');
    dropdowns.forEach(item => {
        const link = item.querySelector('.nav-link');
        const menu = item.querySelector('.dropdown-menu');
        
        if (menu && link) {
             // Clone link to remove old listeners
             const newLink = link.cloneNode(true);
             link.parentNode.replaceChild(newLink, link);
             
             newLink.addEventListener('click', (e) => {
                if (window.innerWidth <= 768) {
                    // Only toggle if the icon was clicked
                    if (e.target.tagName === 'ION-ICON' || e.target.closest('ion-icon')) {
                        e.preventDefault();
                        e.stopPropagation(); // Stop bubbling
                        menu.classList.toggle('active');
                        
                        // Rotate icon
                        const icon = newLink.querySelector('ion-icon');
                        if (icon) {
                            icon.style.transform = menu.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0)';
                            icon.style.transition = 'transform 0.3s ease';
                        }
                    } 
                    // Otherwise let the link navigate normally
                }
            });
        }
    });

    // Helper function to close mobile menu
    const closeMobileMenu = () => {
        const nav = document.querySelector('.nav');
        const menuIcon = document.querySelector('.mobile-menu-icon');
        if (nav && nav.classList.contains('open')) {
            nav.classList.remove('open');
            if (menuIcon) {
                const icon = menuIcon.querySelector('ion-icon');
                if (icon) icon.setAttribute('name', 'menu-outline');
            }
        }
    };

    // Close menu when ANY nav link is clicked/touched (handles iOS)
    // This is separate from smooth scrolling to ensure menu closes on all devices
    const navLinks = document.querySelectorAll('.nav a, .nav .nav-link');
    navLinks.forEach(link => {
        // Skip links that are dropdown toggles (have dropdown-menu sibling)
        const parentItem = link.closest('.nav-item');
        const hasDropdown = parentItem && parentItem.querySelector('.dropdown-menu');
        const isDropdownToggleIcon = link.querySelector('ion-icon[name*="chevron"]');
        
        // Only add close handler if this isn't a dropdown toggle
        if (!isDropdownToggleIcon) {
            // Use touchstart for iOS (fires before click)
            link.addEventListener('touchstart', function(e) {
                // Only on mobile viewport
                if (window.innerWidth <= 768) {
                    // Small delay to allow the touch to register as a click
                    setTimeout(closeMobileMenu, 100);
                }
            }, { passive: true });
            
            // Also add click for desktop mobile emulators
            link.addEventListener('click', function(e) {
                if (window.innerWidth <= 768) {
                    closeMobileMenu();
                }
            });
        }
    });

    // Smooth Scrolling for Anchors (re-bind)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            
            // Only handle links that actually start with #
            if (!targetId || !targetId.startsWith('#')) return;
            if (targetId === '#') {
                e.preventDefault();
                return;
            }
            
            e.preventDefault();
            
            // Close mobile menu (redundant but ensures it's closed)
            closeMobileMenu();
            
            try {
                const targetElement = document.querySelector(targetId);

                if (targetElement) {
                    // Get current header height which might change
                    const headerHeight = document.querySelector('.header').classList.contains('scrolled') ? 80 : 100;
                    
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            } catch (err) {
                console.warn('Smooth scroll invalid target:', targetId);
            }
        });
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
