import "./Footer.css";
import { Link } from "react-router-dom";
import {
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineMapPin,
} from "react-icons/hi2";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        {/* Company Info */}
        <div className="footer-section">
          <div className="footer-brand">
            <div>
              <img src="/quicktasks-logo.svg" alt="QuickTasks logo" />
            </div>
            <span>QuickTasks</span>
          </div>
          <p>
            Empowering teams and individuals to achieve more through intelligent
            task management. Simple, powerful, and designed for productivity.
          </p>
          <div className="footer-contact">
            <div className="contact-item">
              <HiOutlineEnvelope />
              <span>hello@quicktasks.com</span>
            </div>
            <div className="contact-item">
              <HiOutlinePhone />
              <span>+1 (555) 123-4567</span>
            </div>
            <div className="contact-item">
              <HiOutlineMapPin />
              <span>San Francisco, CA</span>
            </div>
          </div>
        </div>

        {/* Product */}
        <div className="footer-section">
          <h4>Product</h4>
          <ul>
            <li>
              <Link to="/features">Features</Link>
            </li>
            <li>
              <Link to="/pricing">Pricing</Link>
            </li>
            <li>
              <Link to="/integrations">Integrations</Link>
            </li>
            <li>
              <Link to="/security">Security</Link>
            </li>
            <li>
              <Link to="/api">API</Link>
            </li>
          </ul>
        </div>

        {/* Company */}
        <div className="footer-section">
          <h4>Company</h4>
          <ul>
            <li>
              <Link to="/about">About Us</Link>
            </li>
            <li>
              <Link to="/careers">Careers</Link>
            </li>
            <li>
              <Link to="/blog">Blog</Link>
            </li>
            <li>
              <Link to="/press">Press</Link>
            </li>
            <li>
              <Link to="/partners">Partners</Link>
            </li>
          </ul>
        </div>

        {/* Resources */}
        <div className="footer-section">
          <h4>Resources</h4>
          <ul>
            <li>
              <Link to="/help">Help Center</Link>
            </li>
            <li>
              <Link to="/docs">Documentation</Link>
            </li>
            <li>
              <Link to="/tutorials">Tutorials</Link>
            </li>
            <li>
              <Link to="/community">Community</Link>
            </li>
            <li>
              <Link to="/status">Status</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-copyright">
          <p>&copy; {currentYear} QuickTasks. All rights reserved.</p>
        </div>
        <div className="footer-legal">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/cookies">Cookie Policy</Link>
        </div>
      </div>
    </footer>
  );
}
