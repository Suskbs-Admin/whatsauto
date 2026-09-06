const fs = require('fs');
const path = require('path');

function getVersion() {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
        return pkg.version || '1.0.0';
    } catch { return '1.0.0'; }
}

// ANSI colors — WhatsApp green theme
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const BRIGHT_GREEN = '\x1b[92m';
const BG_GREEN = '\x1b[42m';
const WHITE = '\x1b[97m';
const BG_WHITE = '\x1b[47m';
const GRAY = '\x1b[90m';
const BRIGHT_WHITE = '\x1b[97m';
const CYAN = '\x1b[36m';

function printBanner() {
    // Main banner — WhatsAuto large ASCII with colored WhatsApp logo (as liked by user)
    const version = getVersion();
    const banner = `
${GREEN}${BOLD}
 ██╗    ██╗██╗  ██╗ █████╗ ████████╗███████╗ █████╗ ██╗   ██╗████████╗  ██████╗
 ██║    ██║██║  ██║██╔══██╗╚══██╔══╝██╔════╝██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗
 ██║ █╗ ██║███████║███████║   ██║   ███████╗███████║██║   ██║   ██║   ██║   ██║
 ██║███╗██║██╔══██║██╔══██║   ██║   ╚════██║██╔══██║██║   ██║   ██║   ██║   ██║
 ╚███╔███╔╝██║  ██║██║  ██║   ██║   ███████║██║  ██║╚██████╔╝   ██║   ╚██████╔╝
  ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝
${BOLD} WhatsAuto ${RESET}${WHITE}${BOLD} Bulk Automation  ${RESET} ${GREEN} v${version} ${RESET} ${GRAY} | Bulk Meet & Form | Groups ${RESET}

`;
    console.log(banner);
}

function printAltBanner() {
    // Small alternative banner (kept for compatibility)
    const version = getVersion();
    const banner = `
${BRIGHT_GREEN}${BOLD}  __          __  _               _         ${RESET}  ${BG_GREEN}${WHITE}${BOLD}  WhatsApp  ${RESET} ${GREEN}${BOLD} WhatsAuto${RESET}${DIM}  v${version}${RESET}
${BRIGHT_GREEN}${BOLD}   \\ \\        / / | |__    __ _ | |_  ___      ${RESET} ${BG_GREEN}${WHITE}  .--------.  ${RESET}
${BRIGHT_GREEN}${BOLD}    \\ \\  /\\  / /  | '_ \\  / _\` || __|/ __|     ${RESET} ${BG_GREEN}${WHITE} /  _    _ \\ ${RESET}  ${WHITE}${BOLD}Bulk Meet Automation${RESET}
${BRIGHT_GREEN}${BOLD}     \\ \\/  \\/ /   | | | || (_| || |_ \\__ \\    ${RESET} ${BG_GREEN}${WHITE}|  | |  | | |${RESET}  ${GRAY}CSV -> WhatsApp + Groups${RESET}
${BRIGHT_GREEN}${BOLD}      \\  /\\  /    |_| |_| \\__,_| \\__|___/    ${RESET} ${BG_GREEN}${WHITE} |  |  --  | |${RESET}  ${GRAY}Flags: --file --group --meet --form${RESET}
${BRIGHT_GREEN}${BOLD}       \\/  \\/                                 ${RESET} ${BG_GREEN}${WHITE}  \\  '----'  / ${RESET}
${DIM}                                                           ${BG_GREEN}${WHITE}   '--------'   ${RESET}
${GREEN}  ─────────────────────────────────────────────────────────────────────────${RESET}
`;
    console.log(banner);
}

function printCompletionBanner() {
    const banner = `
===================================================== 
             TASK COMPLETED  -  WhatsAuto            
=====================================================

`;
    console.log(banner);
}

function printStartupBannerWithTime() {
    // Main startup banner — WhatsAuto with WhatsApp colored logo
    printBanner();
    console.log(`  ${GRAY}Started at: ${new Date().toLocaleString()}  |  Node ${process.version}  |  ${CYAN}WhatsAuto${GRAY} ready${RESET}`);
    console.log('');
}

module.exports = { printBanner, printAltBanner, printCompletionBanner, printStartupBannerWithTime, getVersion };
