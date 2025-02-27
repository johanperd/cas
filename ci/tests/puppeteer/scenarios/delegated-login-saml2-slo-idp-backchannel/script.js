const puppeteer = require('puppeteer');
const cas = require('../../cas.js');
const path = require('path');
const assert = require('assert');

(async () => {
    let ssoSessionsUrl = `https://localhost:8443/cas/actuator/ssoSessions`;
    await cas.logg("Removing all SSO Sessions");
    await cas.doRequest(`${ssoSessionsUrl}`, "DELETE", {});

    const browser = await puppeteer.launch(cas.browserOptions());
    const page = await cas.newPage(browser);

    await cas.goto(page, "https://localhost:8444");
    await page.waitForTimeout(1000);

    await cas.log("Accessing protected CAS application");
    await cas.goto(page, "https://localhost:8444/protected");
    await cas.logPage(page);

    // await cas.goto(page, "https://localhost:8443/cas/login?locale=en");
    await page.waitForTimeout(2000);
    await cas.screenshot(page);

    await cas.assertVisibility(page, '#loginProviders');
    await cas.assertVisibility(page, 'li #SAML2Client');

    await cas.log("Choosing SAML2 identity provider for login...");
    await cas.click(page, "li #SAML2Client");
    await page.waitForNavigation();

    await cas.loginWith(page, "user1", "password");
    await page.waitForTimeout(2000);

    await cas.log("Checking CAS application access...");
    url = await page.url();
    await cas.logPage(page);
    await cas.screenshot(page);
    assert(url.startsWith("https://localhost:8444/protected"));
    await cas.assertInnerTextContains(page, "div.starter-template h2 span", "user1@example.com");

    await cas.log("Checking CAS SSO session...");
    await cas.goto(page, "https://localhost:8443/cas/login?locale=en");
    await cas.screenshot(page);
    await cas.assertCookie(page);
    await cas.assertPageTitle(page, "CAS - Central Authentication Service Log In Successful");
    await cas.assertInnerText(page, '#content div h2', "Log In Successful");
    
    await cas.log(`Navigating to ${ssoSessionsUrl}`);
    await page.goto(ssoSessionsUrl);
    let content = await cas.textContent(page, "body");
    const payload = JSON.parse(content);
    await cas.log(payload);
    let sessionIndex = payload.activeSsoSessions[0].principal_attributes.sessionindex;
    await cas.log(`Session index captured is ${sessionIndex}`);
    
    let logoutRequest = `
    <samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" 
        ID="_21df91a89767879fc0f7df6a1490c6000c81644d" 
        Version="2.0" IssueInstant="2023-07-18T01:13:06Z" Destination="http://localhost:8443/cas/login?client_name=SAML2Client">
        <saml:Issuer>http://localhost:9443/simplesaml/saml2/idp/metadata.php</saml:Issuer>
    <saml:NameID SPNameQualifier="urn:mace:saml:pac4j.org" Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">_f92cc1834efc0f73e9c09f482fce80037a6251e7</saml:NameID>
    <samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>
    </samlp:LogoutRequest>`;

    await cas.log("Sending back-channel logout request via POST");
    await page.waitForTimeout(3000);
    let logoutUrl = `https://localhost:8443/cas/login?client_name=SAML2Client&SAMLRequest=${logoutRequest}&RelayState=_e0d9e4dddf88cc6a4979d677aefdca4881954e8102`;
    await cas.doPost(logoutUrl, {}, {
        'Content-Type': "text/xml"
    }, res => {
        cas.log(res.status);
        assert(res.status === 204);
    }, err => {
        throw err;
    });
    
    await page.waitForTimeout(2000);
    await cas.log("Invoking SAML2 identity provider SLO...");
    await cas.goto(page, "http://localhost:9443/simplesaml/saml2/idp/SingleLogoutService.php?ReturnTo=https://apereo.github.io");
    await page.waitForTimeout(6000);
    url = await page.url();
    await cas.logPage(page);
    assert(url.startsWith("https://apereo.github.io"));

    await cas.log("Going to CAS login page to check for session termination");
    await cas.goto(page, "https://localhost:8443/cas/login?locale=en");
    await page.waitForTimeout(2000);
    await cas.screenshot(page);

    await cas.log("Accessing protected CAS application");
    await cas.goto(page, "https://localhost:8444/protected");
    await page.waitForTimeout(3000);
    await cas.screenshot(page);
    url = await page.url();
    await cas.logPage(page);

    assert(url.startsWith("https://localhost:8443/cas/login"));
    await cas.assertCookie(page, false);
    await cas.removeDirectoryOrFile(path.join(__dirname, '/saml-md'));
    
    await browser.close();
})();


