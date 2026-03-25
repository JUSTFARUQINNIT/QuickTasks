import "./ContactPage.css";
import { HiOutlineArrowLeft } from "react-icons/hi2";

export function ContactPage() {
  return (
    <div className="tasks-shell">
      <section className="tasks-panel tasks-list-panel">
        <div className="tasks-lists-header">
          <button
            type="button"
            className="icon-button"
            onClick={() => window.history.back()}
          >
            <HiOutlineArrowLeft />
          </button>
          <div>
            <p className="task-subtitle">Contact QuickTasks</p>
          </div>
        </div>

        <div className="contact-page-content">
          <div className="contact-info-card">
            <h2>Get in Touch</h2>
            <p>Have questions about QuickTasks? We're here to help!</p>

            <div className="contact-methods">
              <div className="contact-method">
                <h3>📧 Email</h3>
                <p>support@quicktasks.com</p>
                <span>Best for: Technical support, general questions</span>
              </div>

              <div className="contact-method">
                <h3>📞 Phone</h3>
                <p>+1 (555) 123-4567</p>
                <span>Best for: Urgent issues, sales inquiries</span>
              </div>

              <div className="contact-method">
                <h3>📍 Office</h3>
                <p>123 Tech Street, Silicon Valley, CA 94025</p>
                <span>Best for: In-person meetings, partnerships</span>
              </div>
            </div>
          </div>

          <div className="contact-form-card">
            <h2>Send us a Message</h2>
            <form className="contact-form">
              <div className="form-group">
                <label>Your Name</label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Your Email</label>
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Topic</label>
                <select required>
                  <option value="">Select a topic</option>
                  <option value="support">Technical Support</option>
                  <option value="sales">Sales Inquiry</option>
                  <option value="feedback">Feedback</option>
                  <option value="partnership">Partnership</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Message</label>
                <textarea
                  placeholder="Tell us how we can help you..."
                  rows={6}
                  required
                ></textarea>
              </div>

              <button type="submit" className="btn btn-primary">
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
