// Fallback for the implicit `children` slot when the intercepted
// /property/[id] route is reached from OUTSIDE the explore page (e.g. a
// property link on /properties or a city page): there is no previously-active
// explore page to keep showing, so render the app fresh — the visitor lands
// in the live map with the detail panel open over it.
export { default } from "./page";
