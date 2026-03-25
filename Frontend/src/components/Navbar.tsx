import "./Navbar.css";
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { HiBars3, HiOutlineXMark } from "react-icons/hi2";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const location = useLocation();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const isCurrentPath = (path: string) => {
    return location.pathname === path;
  };

  const isCurrentSection = (section: string) => {
    return activeSection === section;
  };

  // Handle scroll-based active state for landing page sections
  useEffect(() => {
    // Only run scroll detection on landing page
    if (location.pathname !== "/") return;

    const sections = ["features", "services", "about", "contact"];

    const handleScroll = () => {
      let current = "";

      sections.forEach((section) => {
        const el = document.getElementById(section);
        if (el) {
          const sectionTop = el.offsetTop - 120;
          if (window.scrollY >= sectionTop) {
            current = section;
          }
        }
      });

      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname]);

  return (
    <nav className="navbar">
      <div className="nav-container">
        {/* Logo */}
        <Link to="/" className="nav-brand" onClick={closeMobileMenu}>
          <img
            src="/quicktasks-logo.svg"
            alt="QuickTasks logo"
            className="nav-logo-img"
          />
          <span className="nav-title">QuickTasks</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="nav-menu">
          <Link
            to="/features"
            className={`nav-link ${isCurrentPath("/features") || isCurrentSection("features") ? "active" : ""}`}
            onClick={closeMobileMenu}
          >
            Features
          </Link>
          <Link
            to="/pricing"
            className={`nav-link ${isCurrentPath("/pricing") || isCurrentSection("services") ? "active" : ""}`}
            onClick={closeMobileMenu}
          >
            Pricing
          </Link>
          <Link
            to="/about"
            className={`nav-link ${isCurrentPath("/about") || isCurrentSection("about") ? "active" : ""}`}
            onClick={closeMobileMenu}
          >
            About
          </Link>
          <Link
            to="/contact"
            className={`nav-link ${isCurrentPath("/contact") || isCurrentSection("contact") ? "active" : ""}`}
            onClick={closeMobileMenu}
          >
            Contact
          </Link>
        </div>

        {/* Desktop Actions */}
        <div className="nav-actions">
          <Link to="/signin" className="nav-signin" onClick={closeMobileMenu}>
            Sign In
          </Link>
          <Link to="/signup" className="nav-cta" onClick={closeMobileMenu}>
            Get Started
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="nav-mobile-toggle"
          onClick={toggleMobileMenu}
          aria-label="Toggle mobile menu"
        >
          {mobileMenuOpen ? <HiOutlineXMark /> : <HiBars3 />}
        </button>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="nav-mobile-menu">
            <Link
              to="/features"
              className={`nav-link ${isCurrentPath("/features") || isCurrentSection("features") ? "active" : ""}`}
              onClick={closeMobileMenu}
            >
              Features
            </Link>
            <Link
              to="/pricing"
              className={`nav-link ${isCurrentPath("/pricing") || isCurrentSection("services") ? "active" : ""}`}
              onClick={closeMobileMenu}
            >
              Pricing
            </Link>
            <Link
              to="/about"
              className={`nav-link ${isCurrentPath("/about") || isCurrentSection("about") ? "active" : ""}`}
              onClick={closeMobileMenu}
            >
              About
            </Link>
            <Link
              to="/contact"
              className={`nav-link ${isCurrentPath("/contact") || isCurrentSection("contact") ? "active" : ""}`}
              onClick={closeMobileMenu}
            >
              Contact
            </Link>
            <div className="nav-mobile-actions">
              <Link
                to="/signin"
                className="nav-signin"
                onClick={closeMobileMenu}
              >
                Sign In
              </Link>
              <Link to="/signup" className="nav-cta" onClick={closeMobileMenu}>
                Get Started
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
