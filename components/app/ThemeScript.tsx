/**
 * Applies the saved theme before the browser paints.
 *
 * This has to be a blocking inline script in <head>. Doing it in an effect
 * means React has already painted the light theme once, which shows as a white
 * flash on every navigation — worst on the study screen, at night, which is
 * exactly when someone turns dark mode on.
 *
 * The stored value is only ever "dark", "light" or "system"; anything else
 * falls through to the media query.
 */
const SCRIPT = `(function(){try{
var t=localStorage.getItem('kanjikan-theme');
if(t!=='dark'&&t!=='light'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
document.documentElement.setAttribute('data-theme',t);
}catch(e){document.documentElement.setAttribute('data-theme','light')}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
