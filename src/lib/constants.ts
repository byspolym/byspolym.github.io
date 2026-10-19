import type { Role } from "./types";

export const APP_NAME = "Byspolyhub";
export const APP_TAGLINE = "The official social hub for Bayelsa State Polytechnic";
export const SCHOOL_NAME = "Bayelsa State Polytechnic";
export const SCHOOL_SHORT = "BYSPOLY";
export const CAMPUS = "Aleibiri, Ekeremor LGA, Bayelsa State, Nigeria";
export const ESTABLISHED = 2014;
export const CONTACT_EMAIL = "info@bayelsastatepoly.edu.ng";
export const CONTACT_PHONE = "09066773570";
export const RECTOR = "Mr. Wisdom Clinton Soreh";

export const DEPARTMENTS = [
  "Electrical Engineering",
  "Computer Science",
  "Computer Engineering",
  "Mass Communication",
  "Accountancy",
  "Law",
  "Statistics",
] as const;

export const LEVELS = [
  "ND I",
  "ND II",
  "HND I",
  "HND II",
  "Foundation",
  "Staff",
  "Alumni",
] as const;

export const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: "student", label: "Student", hint: "Currently enrolled ND, HND or Foundation" },
  { id: "staff", label: "Staff", hint: "Academic or non-academic staff" },
  { id: "alumni", label: "Alumni", hint: "Graduated from BYSPOLY" },
];

export const SCHOOLS = [
  {
    name: "School of Engineering Technology",
    departments: ["Electrical Engineering", "Computer Engineering"],
  },
  {
    name: "School of Applied Sciences",
    departments: ["Computer Science", "Statistics"],
  },
  {
    name: "School of Commerce & Management",
    departments: ["Accountancy", "Mass Communication"],
  },
  {
    name: "School of Foundation Studies",
    departments: ["Law"],
  },
];

export const LEADERSHIP = [
  {
    name: "Mr. Wisdom Clinton Soreh",
    title: "Rector",
    credentials: "HND, MBA, MSc, FCILRM, FCHIRM, FIPMAN",
    image: "/leadership/rector.jpg",
  },
  {
    name: "Mrs. Patience A. Zuokemefa",
    title: "Registrar",
    credentials: "Principal officer",
    image: "/leadership/registrar.jpg",
  },
  {
    name: "Mr. Kingeorge Okoro",
    title: "Deputy Rector, Academics",
    credentials: "Academic leadership",
    image: "/leadership/deputy-academics.jpg",
  },
  {
    name: "Dr. (Mrs.) Yaguo Ikele Eremasi",
    title: "Deputy Rector, Administration",
    credentials: "Administration",
    image: "/leadership/deputy-admin.jpg",
  },
  {
    name: "Dr. (Mrs.) Oyinkepreye Sawyer-George",
    title: "Librarian",
    credentials: "Library services",
    image: "/leadership/librarian.jpg",
  },
  {
    name: "Mr. Joseph Inini",
    title: "Bursar",
    credentials: "Finance",
    image: "/leadership/bursar.jpg",
  },
];

export const MISSION =
  "To strive towards producing self-reliant graduates with technical and entrepreneurial skills founded on ethical values.";

export const VISION =
  "A technological institution for innovative thinking and entrepreneurial skills for a sustainable self-reliant future.";

export const RECTOR_WELCOME =
  "The world is in constant flux, and the needs assessment of our economy shows a lack of a practical, knowledge-oriented workforce. BYSPOLY is designed to inculcate in our students the spirit of tolerance of divergent shades of opinion as they interact with a global mindset. An educated person is a citizen of the whole world. We are poised to instil in our students the light and skills that enhance self-reliance.";

export const ADMIN_EMAILS = ["admin@byspolyhub.github.io", "admin2@byspolyhub.github.io"] as const;

export const REPORT_REASONS = [
  "Harassment or bullying",
  "Hate speech or discrimination",
  "Spam or misleading",
  "Nudity or sexual content",
  "Impersonation",
  "Academic misconduct",
  "Other",
];

export const GROUP_CATEGORIES = [
  "Student union",
  "Department",
  "Professional",
  "Faith & culture",
  "Sports",
  "Skills & enterprise",
  "Media",
];

export const PAGE_SIZE = 8;
