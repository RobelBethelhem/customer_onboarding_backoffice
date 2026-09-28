import { NextRequest, NextResponse } from 'next/server';

/**
 * TEST ENDPOINT: Send the EXACT working Fayda XML to FlexCube
 *
 * GET /api/flexcube/test — sends the exact working XML (with random NATIONID)
 *
 * This is to verify the FlexCube endpoint works with the known-good XML format.
 */
export async function GET(request: NextRequest) {
  const url = 'http://10.1.1.155:7107/FCUBSCustomerService/FCUBSCustomerService';
  const timeout = 30000;

  // Generate unique values to avoid duplicates
  const msgId = Date.now().toString();
  const randomNationId = Array.from({ length: 27 }, () => Math.floor(Math.random() * 10)).join('');
  const correlId = `${msgId.substring(0, 8)}-${Math.random().toString(16).substring(2, 6)}-${Math.random().toString(16).substring(2, 6)}-${Math.random().toString(16).substring(2, 6)}-${Math.random().toString(16).substring(2, 14)}`;

  // EXACT working Fayda XML — only changed MSGID, CORRELID, NATIONID, SNAME for uniqueness
  const exactWorkingXml = `<?xml version="1.0" encoding="UTF-8"?><ns2:CREATECUSTOMER_FSFS_REQ xmlns:ns2="http://fcubs.ofss.com/service/FCUBSCustomerService">
    <ns2:FCUBS_HEADER>
        <ns2:SOURCE>EXTFYDA</ns2:SOURCE>
        <ns2:UBSCOMP>FCUBS</ns2:UBSCOMP>
        <ns2:MSGID>${msgId}</ns2:MSGID>
        <ns2:CORRELID>${correlId}</ns2:CORRELID>
        <ns2:USERID>IB_SER</ns2:USERID>
        <ns2:BRANCH>349</ns2:BRANCH>
        <ns2:SERVICE>FCUBSCustomerService</ns2:SERVICE>
        <ns2:OPERATION>CreateCustomer</ns2:OPERATION>
        <ns2:ACTION>NEW</ns2:ACTION>
    </ns2:FCUBS_HEADER>
    <ns2:FCUBS_BODY>
        <ns2:Customer-Full>
            <ns2:CTYPE>I</ns2:CTYPE>
            <ns2:NAME>ktyrISA SpiuytMON uytredft</ns2:NAME>
            <ns2:ADDRLN1>Oromia</ns2:ADDRLN1>
            <ns2:ADDRLN3>Bakanisa Kase</ns2:ADDRLN3>
            <ns2:ADDRLN2>Nekemte City Administration</ns2:ADDRLN2>
            <ns2:ADDRLN4>NO</ns2:ADDRLN4>
            <ns2:COUNTRY>ET</ns2:COUNTRY>
            <ns2:SNAME>DEBISA${msgId}</ns2:SNAME>
            <ns2:NLTY>ET</ns2:NLTY>
            <ns2:CCATEG>INDI</ns2:CCATEG>
            <ns2:FULLNAME>ktyrISA SpiuytMON uytredft</ns2:FULLNAME>
            <ns2:MEDIA>MAIL</ns2:MEDIA>
            <ns2:LOC>CIF</ns2:LOC>
            <ns2:TAXIDENTITY/>
            <ns2:AUTHSTAT>A</ns2:AUTHSTAT>
            <ns2:Custpersonal>
                <ns2:FSTNAME>ktyrISA</ns2:FSTNAME>
                <ns2:MIDNAME>SpiuytMON</ns2:MIDNAME>
                <ns2:LSTNAME>uytredft</ns2:LSTNAME>
                <ns2:DOB>1991-07-26</ns2:DOB>
                <ns2:GENDR>M</ns2:GENDR>
                <ns2:NATIONID>${randomNationId}</ns2:NATIONID>
                <ns2:PPTNO>0000000000</ns2:PPTNO>
                <ns2:PPTISSDT>2025-02-18</ns2:PPTISSDT>
                <ns2:PPTEXPDT>2126-02-18</ns2:PPTEXPDT>
                <ns2:EMAILID>bc@gml.com</ns2:EMAILID>
                <ns2:MOBNUM>+251900000000</ns2:MOBNUM>
                <ns2:LANG>ENG</ns2:LANG>
                <ns2:MINOR>N</ns2:MINOR>
                <ns2:SAME_CORR_ADDR>Y</ns2:SAME_CORR_ADDR>
                <ns2:TITLE>ATO</ns2:TITLE>
                <ns2:PAISSUED>N</ns2:PAISSUED>
                <ns2:MOTHERMAIDN_NAME>klopytr uiohhgft</ns2:MOTHERMAIDN_NAME>
            </ns2:Custpersonal>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>MAINT_FEE_WAIVED</ns2:FLDNAM>
                <ns2:FLDVAL>Y</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>CUSTOMER_SEGMENTATION</ns2:FLDNAM>
                <ns2:FLDVAL>RETAIL CUSTOMER</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>PROMOTION_TYPE</ns2:FLDNAM>
                <ns2:FLDVAL>CUSTOMER_REFERAL</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>WEALTH_SOURCE</ns2:FLDNAM>
                <ns2:FLDVAL>SB</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>OCCUPATION</ns2:FLDNAM>
                <ns2:FLDVAL>SE</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>INDUSTRY</ns2:FLDNAM>
                <ns2:FLDVAL>O</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>ANNUAL_INCOME</ns2:FLDNAM>
                <ns2:FLDVAL>240000.00</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>CURRENCY_REDEMPTION_PURPOSE</ns2:FLDNAM>
                <ns2:FLDVAL>N</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>IS_THE_CUSTOMER_IN_SANCTION_LIST</ns2:FLDNAM>
                <ns2:FLDVAL>N</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>CUSTOMER_RISK_RATING</ns2:FLDNAM>
                <ns2:FLDVAL>LOW</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>CB_RM_GROUP</ns2:FLDNAM>
                <ns2:FLDVAL>NA</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>LEAD_RM</ns2:FLDNAM>
                <ns2:FLDVAL>NA</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>AGENTS_NATIONAL_ID_NUMBER</ns2:FLDNAM>
                <ns2:FLDVAL/>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>VAT_NO</ns2:FLDNAM>
                <ns2:FLDVAL/>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>PLTCS_EX_PERSON</ns2:FLDNAM>
                <ns2:FLDVAL>NO</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>OTHER_WEALTH_SOURCE</ns2:FLDNAM>
                <ns2:FLDVAL/>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>OTHER_OCCUPATION</ns2:FLDNAM>
                <ns2:FLDVAL>SE</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>OTHER_INDUSTRY</ns2:FLDNAM>
                <ns2:FLDVAL/>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>MAKER</ns2:FLDNAM>
                <ns2:FLDVAL>ZERIHUNT</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>CHECKER</ns2:FLDNAM>
                <ns2:FLDVAL>EPHREMT</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>FAYDA_PHONE_NUMBER</ns2:FLDNAM>
                <ns2:FLDVAL>+251900000000</ns2:FLDVAL>
            </ns2:UDFDETAILS>
            <ns2:UDFDETAILS>
                <ns2:FLDNAM>FAYDA_EMAIL</ns2:FLDNAM>
                <ns2:FLDVAL/>
            </ns2:UDFDETAILS>
        </ns2:Customer-Full>
    </ns2:FCUBS_BODY>
</ns2:CREATECUSTOMER_FSFS_REQ>`;

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`[FlexCube TEST] Sending EXACT working Fayda XML`);
  console.log(`[FlexCube TEST] URL: ${url}`);
  console.log(`[FlexCube TEST] NATIONID: ${randomNationId}`);
  console.log(`[FlexCube TEST] MSGID: ${msgId}`);
  console.log(`${'═'.repeat(80)}`);
  console.log(exactWorkingXml);
  console.log(`${'═'.repeat(80)}\n`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const startTime = Date.now();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': '',
      },
      body: exactWorkingXml,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseText = await response.text();
    const elapsed = Date.now() - startTime;

    console.log(`\n${'═'.repeat(80)}`);
    console.log(`[FlexCube TEST] RESPONSE (${elapsed}ms) — HTTP ${response.status}`);
    console.log(`${'═'.repeat(80)}`);
    console.log(responseText);
    console.log(`${'═'.repeat(80)}\n`);

    // Check for success
    const msgStat = responseText.match(/<MSGSTAT>(\w+)<\/MSGSTAT>/)?.[1];
    const custNo = responseText.match(/<CUSTNO>([^<]+)<\/CUSTNO>/)?.[1];
    const ecode = responseText.match(/<ECODE>([^<]+)<\/ECODE>/)?.[1];
    const edesc = responseText.match(/<EDESC>([^<]+)<\/EDESC>/)?.[1];

    return NextResponse.json({
      success: msgStat === 'SUCCESS',
      msgStat,
      custNo: custNo || null,
      error: ecode ? `${ecode}: ${edesc}` : null,
      elapsed: `${elapsed}ms`,
      nationId: randomNationId,
      msgId,
      rawResponse: responseText,
    });
  } catch (error: any) {
    console.error(`[FlexCube TEST] ERROR:`, error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
