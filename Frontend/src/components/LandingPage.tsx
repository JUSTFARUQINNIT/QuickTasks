import "./LandingPage.css";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  HiOutlineCheckCircle,
  HiOutlineUsers,
  HiOutlineClock,
  HiOutlineChartBar,
  HiOutlineArrowRight,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineMapPin,
  HiOutlineSparkles,
  HiOutlineShieldCheck,
  HiOutlineBolt,
} from "react-icons/hi2";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function LandingPage() {
  const [email, setEmail] = useState("");
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    company: "",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Email submitted:", email);
    setEmail("");
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormMessage("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8787"}/api/contact`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(contactForm),
        },
      );

      const data = await response.json();

      if (response.ok) {
        setFormMessage(
          "✅ Message sent successfully! We'll get back to you within 24 hours.",
        );
        setContactForm({
          name: "",
          email: "",
          subject: "",
          message: "",
          company: "",
        });
      } else {
        setFormMessage(
          `❌ ${data.error || "Failed to send message. Please try again."}`,
        );
      }
    } catch (error) {
      console.error("Contact form error:", error);
      setFormMessage("❌ Failed to send message. Please try again later.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleContactChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setContactForm({
      ...contactForm,
      [e.target.name]: e.target.value,
    });
  };

  // Clear form message after 3 seconds
  useEffect(() => {
    if (formMessage) {
      const timer = setTimeout(() => {
        setFormMessage("");
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [formMessage]);
  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <Navbar />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <HiOutlineSparkles />
              <span>Task Management Reimagined</span>
            </div>
            <h1 className="hero-title">
              Stay Organized, <span className="highlight">Achieve More</span>
            </h1>
            <p className="hero-subtitle">
              QuickTasks helps teams and individuals manage their work
              efficiently with real-time collaboration, smart notifications, and
              intuitive task tracking.
            </p>
            <div className="hero-actions">
              <Link to="/signup" className="btn btn-primary btn-large">
                Get Started Free
                <HiOutlineArrowRight />
              </Link>
              <Link to="/signin" className="btn btn-secondary btn-large">
                Sign In
              </Link>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-number">10K+</span>
                <span className="stat-label">Active Users</span>
              </div>
              <div className="stat">
                <span className="stat-number">50K+</span>
                <span className="stat-label">Tasks Completed</span>
              </div>
              <div className="stat">
                <span className="stat-number">99.9%</span>
                <span className="stat-label">Uptime</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image-placeholder">
              <div className="task-card">
                <div className="task-header">
                  <div className="task-avatar">JD</div>
                  <div className="task-info">
                    <h4>Project Launch</h4>
                    <span>Due in 2 days</span>
                  </div>
                </div>
                <div className="task-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: "75%" }}
                    ></div>
                  </div>
                  <span>75% Complete</span>
                </div>
              </div>
              <div className="floating-cards">
                <div className="mini-card card-1">
                  <HiOutlineCheckCircle />
                  <span>3 tasks done</span>
                </div>
                <div className="mini-card card-2">
                  <HiOutlineUsers />
                  <span>5 collaborators</span>
                </div>
                <div className="mini-card card-3">
                  <HiOutlineClock />
                  <span>2 hours saved</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features">
        <div className="container">
          <div className="section-header">
            <h2>Powerful Features for Modern Teams</h2>
            <p>
              Everything you need to manage tasks efficiently and collaborate
              seamlessly
            </p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <HiOutlineBolt />
              </div>
              <h3>Real-time Updates</h3>
              <p>
                See changes instantly as your team updates tasks. No more
                confusion about who's working on what.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <HiOutlineUsers />
              </div>
              <h3>Team Collaboration</h3>
              <p>
                Invite team members, assign tasks, and track progress together
                with built-in commenting system.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <HiOutlineClock />
              </div>
              <h3>Smart Reminders</h3>
              <p>
                Never miss a deadline with intelligent notifications and due
                date tracking.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <HiOutlineChartBar />
              </div>
              <h3>Progress Analytics</h3>
              <p>
                Track your productivity with detailed insights and completion
                metrics.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <HiOutlineShieldCheck />
              </div>
              <h3>Secure & Private</h3>
              <p>
                Your data is encrypted and secure. Enterprise-grade security for
                your peace of mind.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <HiOutlineSparkles />
              </div>
              <h3>Easy to Use</h3>
              <p>
                Intuitive interface that gets you started in minutes, not hours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section">
        <div className="container">
          <div className="benefits-content">
            <div className="benefits-text">
              <h2>Why QuickTasks Matters</h2>
              <p className="benefits-intro">
                In today's fast-paced world, staying organized isn't just
                nice—it's essential. QuickTasks transforms how you manage work,
                bringing clarity to chaos and focus to your daily routine.
              </p>
              <div className="benefits-list">
                <div className="benefit-item">
                  <div className="benefit-icon-main">
                    <HiOutlineCheckCircle className="benefit-icon" />
                    <h4>Eliminate Missed Deadlines</h4>
                  </div>
                  <p>
                    Smart notifications ensure you never forget important tasks
                    or meetings.
                  </p>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon-main">
                    <HiOutlineUsers className="benefit-icon" />
                    <h4>Improve Team Communication</h4>
                  </div>
                  <p>
                    Centralized task management keeps everyone aligned and
                    informed.
                  </p>
                </div>
                <div className="benefit-item">
                  <div className="benefit-icon-main">
                    <HiOutlineChartBar className="benefit-icon" />
                    <h4>Boost Productivity</h4>
                  </div>
                  <p>
                    Clear priorities and progress tracking help you focus on
                    what matters most.
                  </p>
                </div>
              </div>
            </div>
            <div className="benefits-visual">
              <div className="productivity-chart">
                <div className="chart-bar" style={{ height: "60%" }}>
                  <span>Before</span>
                </div>
                <div className="chart-bar highlight" style={{ height: "90%" }}>
                  <span>After</span>
                </div>
              </div>
              <p className="chart-caption">
                Average productivity increase with QuickTasks
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="services-section" id="services">
        <div className="container">
          <div className="section-header">
            <h2>Tailored Solutions for Every Need</h2>
            <p>
              Whether you're an individual, small team, or large organization
            </p>
          </div>
          <div className="services-grid">
            <div className="service-card">
              <h3>Personal</h3>
              <div className="price">
                <span className="currency">$</span>
                <span className="amount">0</span>
                <span className="period">/month</span>
              </div>
              <ul className="service-features">
                <li>Up to 100 tasks</li>
                <li>Basic notifications</li>
                <li>Mobile app access</li>
                <li>Email support</li>
              </ul>
              <Link to="/signup" className="btn btn-outline">
                Get Started
              </Link>
            </div>
            <div className="service-card popular">
              <div className="popular-badge">Most Popular</div>
              <h3>Team</h3>
              <div className="price">
                <span className="currency">$</span>
                <span className="amount">8</span>
                <span className="period">/user/month</span>
              </div>
              <ul className="service-features">
                <li>Unlimited tasks</li>
                <li>Advanced notifications</li>
                <li>Team collaboration</li>
                <li>Priority support</li>
                <li>Analytics dashboard</li>
              </ul>
              <Link to="/signup" className="btn btn-primary">
                Start Free Trial
              </Link>
            </div>
            <div className="service-card">
              <h3>Enterprise</h3>
              <div className="price">
                <span className="currency">Custom</span>
              </div>
              <ul className="service-features">
                <li>Everything in Team</li>
                <li>Custom integrations</li>
                <li>Advanced security</li>
                <li>Dedicated support</li>
                <li>SLA guarantee</li>
              </ul>
              <Link to="/contact" className="btn btn-outline">
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section">
        <div className="container">
          <div className="section-header">
            <h2>Loved by Teams Worldwide</h2>
            <p>See what our users have to say about QuickTasks</p>
          </div>
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="testimonial-content">
                "QuickTasks transformed how our team collaborates. We've seen a
                40% increase in productivity!"
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">SM</div>
                <div className="author-info">
                  <h4>Sarah Mitchell</h4>
                  <p>Product Manager, TechCorp</p>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-content">
                "The real-time updates and smart notifications have eliminated
                missed deadlines completely."
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">JD</div>
                <div className="author-info">
                  <h4>John Davis</h4>
                  <p>CEO, StartupHub</p>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-content">
                "Finally, a task management tool that's both powerful and easy
                to use. Our team adopted it instantly!"
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">EC</div>
                <div className="author-info">
                  <h4>Emily Chen</h4>
                  <p>Design Lead, CreativeStudio</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Transform Your Productivity?</h2>
            <p>
              Join thousands of teams already using QuickTasks to achieve more.
            </p>
            <div className="cta-actions">
              <Link to="/signup" className="btn btn-primary btn-large">
                Start Free Today
                <HiOutlineArrowRight />
              </Link>
              <form onSubmit={handleEmailSubmit} className="email-form">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary">
                  Get Updates
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="contact-section" id="contact">
        <div className="container">
          <div className="contact-content">
            <div className="contact-info">
              <h2>Get in Touch</h2>
              <p>
                Have questions? We're here to help you succeed with QuickTasks.
              </p>
              <div className="contact-methods">
                <div className="contact-method">
                  <HiOutlineEnvelope />
                  <div>
                    <h4>Email</h4>
                    <p>support@quicktasks.com</p>
                  </div>
                </div>
                <div className="contact-method">
                  <HiOutlinePhone />
                  <div>
                    <h4>Phone</h4>
                    <p>+1 (555) 123-4567</p>
                  </div>
                </div>
                <div className="contact-method">
                  <HiOutlineMapPin />
                  <div>
                    <h4>Office</h4>
                    <p>123 Tech Street, Silicon Valley, CA 94025</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="contact-form">
              <h3>Send us a Message</h3>

              <form className="form" onSubmit={handleContactSubmit}>
                <div className="form-group">
                  <input
                    type="text"
                    name="name"
                    placeholder="Your Name"
                    value={contactForm.name}
                    onChange={handleContactChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="email"
                    name="email"
                    placeholder="Your Email"
                    value={contactForm.email}
                    onChange={handleContactChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    name="company"
                    placeholder="Your Company (Optional)"
                    value={contactForm.company}
                    onChange={handleContactChange}
                  />
                </div>
                <div className="form-group">
                  <select
                    name="subject"
                    value={contactForm.subject}
                    onChange={handleContactChange}
                    required
                  >
                    <option value="">Select Topic</option>
                    <option value="Technical Support">Technical Support</option>
                    <option value="Sales Inquiry">Sales Inquiry</option>
                    <option value="Feedback">Feedback</option>
                    <option value="Partnership">Partnership</option>
                    <option value="General">General Inquiry</option>
                  </select>
                </div>
                <div className="form-group">
                  <textarea
                    name="message"
                    placeholder="Your Message"
                    value={contactForm.message}
                    onChange={handleContactChange}
                    rows={5}
                    required
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? "Sending..." : "Send Message"}
                </button>

                {formMessage && (
                  <div
                    className={`form-message ${formMessage.includes("✅") ? "success" : "error"}`}
                  >
                    {formMessage}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
