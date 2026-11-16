import { contact } from "./content";

export function Footer() {
  return (
    <footer id="contact" className="site-footer">
      <h2>Say hi.</h2>
      <ul className="contact-links">
        <li>
          <a href={`mailto:${contact.email}`}>
            <img src="/icons/email.svg" alt="Email" width={24} height={18} />
          </a>
        </li>
        <li>
          <a href={contact.linkedin} target="_blank" rel="noreferrer">
            <img src="/icons/linkedin.png" alt="LinkedIn" width={840} height={779} />
          </a>
        </li>
        <li>
          <a href={contact.github} target="_blank" rel="noreferrer">
            <img src="/icons/github.svg" alt="GitHub" width={98} height={96} />
          </a>
        </li>
      </ul>
    </footer>
  );
}
