/**
 * Static mapping of Course Marketplace Subjects (Categories) to sub-topics.
 * This is currently used by the frontend to render the flyout dropdown menus
 * until this structure is migrated to the backend database.
 */

export const CATEGORY_TOPICS: Record<string, string[]> = {
  "Artificial Intelligence": ["Machine Learning", "Deep Learning", "Generative AI", "NLP", "Computer Vision", "Prompt Engineering"],
  "Programming": ["Web Development", "Mobile Apps", "Python", "JavaScript", "C++", "Java", "Go", "Rust"],
  "Digital Marketing": ["SEO", "Social Media", "Content Marketing", "Email Marketing", "PPC", "Analytics"],
  "Entrepreneurship": ["Startup Fundamentals", "Business Strategy", "Fundraising", "Leadership", "Product Management"],
  "Finance": ["Investing", "Personal Finance", "Cryptocurrency", "Corporate Finance", "Accounting", "Trading"],
  "Design": ["Graphic Design", "UI/UX", "3D Modeling", "Animation", "Web Design", "Typography"],
  "Data Science": ["Data Analysis", "Data Visualization", "SQL", "Statistics", "Big Data", "Machine Learning"],
  "Science": ["Physics", "Chemistry", "Biology", "Astronomy", "Environmental Science"],
  "Maths": ["Algebra", "Calculus", "Geometry", "Statistics & Probability", "Discrete Math"],
  "Technology": ["Cloud Computing", "Cybersecurity", "Networking", "DevOps", "IT Support", "Hardware"],
  "Personal Development": ["Productivity", "Communication Skills", "Time Management", "Mindfulness", "Career Development"],
};
