import "./AboutPage.css";
import {
  HiOutlineSparkles,
  HiOutlineUsers,
  HiOutlineShieldCheck,
  HiOutlineLightBulb,
  HiOutlineRocketLaunch,
  HiOutlineHeart,
  HiOutlineTrophy,
  HiOutlineGlobeAlt,
  HiOutlineAcademicCap,
} from "react-icons/hi2";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function AboutPage() {
  return (
    <div className="about-page">
      {/* Navigation Bar */}
      <Navbar />

      {/* Hero Section */}
      <section className="about-hero">
        <div className="hero-container">
          <div className="hero-content">
            <h1>About QuickTasks</h1>
            <p className="hero-subtitle">
              Empowering teams and individuals to achieve more through
              intelligent task management
            </p>
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
        </div>
      </section>

      {/* Mission Section */}
      <section className="mission-section">
        <div className="container">
          <div className="mission-content">
            <div className="mission-text">
              <h2>Our Mission</h2>
              <p>
                At QuickTasks, we believe that great work happens when teams are
                aligned, organized, and focused on what truly matters. Our
                mission is to provide the most intuitive and powerful task
                management platform that helps individuals and teams achieve
                their goals with less stress and more success.
              </p>
              <div className="mission-values">
                <div className="value-item">
                  <HiOutlineSparkles className="value-icon" />
                  <h3>Simplicity</h3>
                  <p>Complex tasks made simple through thoughtful design</p>
                </div>
                <div className="value-item">
                  <HiOutlineUsers className="value-icon" />
                  <h3>Collaboration</h3>
                  <p>Bringing teams together for better outcomes</p>
                </div>
                <div className="value-item">
                  <HiOutlineShieldCheck className="value-icon" />
                  <h3>Reliability</h3>
                  <p>Always there when you need us most</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="story-section">
        <div className="container">
          <div className="story-content">
            <h2>Our Story</h2>
            <div className="story-timeline">
              <div className="timeline-item">
                <div className="timeline-year">2020</div>
                <div className="timeline-content">
                  <h3>The Beginning</h3>
                  <p>
                    QuickTasks started as a simple solution to a common problem:
                    managing team tasks efficiently without the complexity of
                    traditional project management tools.
                  </p>
                </div>
              </div>
              <div className="timeline-item">
                <div className="timeline-year">2021</div>
                <div className="timeline-content">
                  <h3>Growth & Innovation</h3>
                  <p>
                    Expanded our features with real-time collaboration, smart
                    notifications, and advanced analytics based on user
                    feedback.
                  </p>
                </div>
              </div>
              <div className="timeline-item">
                <div className="timeline-year">2022</div>
                <div className="timeline-content">
                  <h3>Scaling New Heights</h3>
                  <p>
                    Reached 10,000+ active users and introduced enterprise
                    features for larger organizations.
                  </p>
                </div>
              </div>
              <div className="timeline-item">
                <div className="timeline-year">2024</div>
                <div className="timeline-content">
                  <h3>The Future</h3>
                  <p>
                    Continuing to innovate with AI-powered features, enhanced
                    integrations, and a commitment to making work more
                    productive and enjoyable.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="team-section">
        <div className="container">
          <div className="section-header">
            <h2>Meet Our Team</h2>
            <p>The passionate people behind QuickTasks</p>
          </div>
          <div className="team-grid">
            <div className="team-member">
              <div className="member-avatar">JD</div>
              <h3>John Davis</h3>
              <p className="member-role">Founder & CEO</p>
              <p className="member-bio">
                Visionary leader with 15+ years in product development,
                passionate about creating tools that make work better.
              </p>
            </div>
            <div className="team-member">
              <div className="member-avatar">SC</div>
              <h3>Sarah Chen</h3>
              <p className="member-role">Head of Product</p>
              <p className="member-bio">
                User experience expert focused on making complex workflows
                simple and intuitive for everyone.
              </p>
            </div>
            <div className="team-member">
              <div className="member-avatar">MR</div>
              <h3>Michael Rodriguez</h3>
              <p className="member-role">CTO</p>
              <p className="member-bio">
                Technical architect ensuring our platform is secure, scalable,
                and cutting-edge.
              </p>
            </div>
            <div className="team-member">
              <div className="member-avatar">EW</div>
              <h3>Emily Watson</h3>
              <p className="member-role">Head of Design</p>
              <p className="member-bio">
                Creative mind behind our beautiful, user-friendly interface that
                makes task management enjoyable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="tech-section">
        <div className="container">
          <div className="section-header">
            <h2>Built with Modern Technology</h2>
            <p>Powerful infrastructure for reliable performance</p>
          </div>
          <div className="tech-grid">
            <div className="tech-item">
              <HiOutlineLightBulb className="tech-icon" />
              <h3>Real-time Sync</h3>
              <p>
                Instant updates across all devices using WebSocket technology
              </p>
            </div>
            <div className="tech-item">
              <HiOutlineShieldCheck className="tech-icon" />
              <h3>Enterprise Security</h3>
              <p>End-to-end encryption and SOC 2 Type II compliance</p>
            </div>
            <div className="tech-item">
              <HiOutlineRocketLaunch className="tech-icon" />
              <h3>Lightning Fast</h3>
              <p>Global CDN and optimized databases for sub-second responses</p>
            </div>
            <div className="tech-item">
              <HiOutlineGlobeAlt className="tech-icon" />
              <h3>Global Scale</h3>
              <p>99.9% uptime with automatic failover and redundancy</p>
            </div>
          </div>
        </div>
      </section>

      {/* Achievements Section */}
      <section className="achievements-section">
        <div className="container">
          <div className="section-header">
            <h2>Our Achievements</h2>
            <p>Recognition and milestones we're proud of</p>
          </div>
          <div className="achievements-grid">
            <div className="achievement-card">
              <HiOutlineTrophy className="achievement-icon" />
              <h3>Best Task Management App</h3>
              <p>SaaS Awards 2023</p>
            </div>
            <div className="achievement-card">
              <HiOutlineUsers className="achievement-icon" />
              <h3>10K+ Happy Users</h3>
              <p>Across 50+ countries worldwide</p>
            </div>
            <div className="achievement-card">
              <HiOutlineHeart className="achievement-icon" />
              <h3>4.9/5 Rating</h3>
              <p>From over 2,000 user reviews</p>
            </div>
            <div className="achievement-card">
              <HiOutlineAcademicCap className="achievement-icon" />
              <h3>Grown 300% Yearly</h3>
              <p>Consistent growth since launch</p>
            </div>
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section className="partners-section">
        <div className="container">
          <div className="section-header">
            <h2>Trusted by Leading Companies</h2>
            <p>Partnering with the best in the industry</p>
          </div>
          <div className="partners-grid">
            <div className="partner-logo">TechCorp</div>
            <div className="partner-logo">StartupHub</div>
            <div className="partner-logo">CreativeStudio</div>
            <div className="partner-logo">DataFlow</div>
            <div className="partner-logo">CloudBase</div>
            <div className="partner-logo">InnovateLab</div>
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
              Start your free trial today and see the difference for yourself.
            </p>
            <div className="cta-buttons">
              <a href="/signup" className="btn btn-primary btn-large">
                Start Free Trial
              </a>
              <a href="/contact" className="btn btn-secondary btn-large">
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
