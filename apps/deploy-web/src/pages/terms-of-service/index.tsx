import React from "react";
import Link from "next/link";

import Layout from "@src/components/layout/Layout";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";
import { Title } from "@src/components/shared/Title";
import { domainName, UrlService } from "@src/utils/urlUtils";

export function TermsOfService() {
  return (
    <Layout>
      <CustomNextSeo title="Terms of service" url={`${domainName}${UrlService.termsOfService()}`} description="Akash Console webiste terms of service." />

      <div className="mx-auto max-w-4xl p-8 leading-relaxed">
        <Title>Akash Network Terms of Service</Title>
        <p className="mb-8 italic">Last updated: July 1st, 2025</p>

        <p className="mb-4">
          These Akash Network Terms of Service (these &quot;Terms&quot; or this &quot;Agreement&quot;) are a contract between you and Overclock Labs Inc.
          (&quot;Akash,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) and govern your access to and use of the website located at
          https://akash.network (the &quot;Website&quot;) and the application interface located at https://console.akash.network/ and all related components
          (the &quot;Platform&quot;), services provided by Akash described below, and such other services, software, applications, features, or products
          provided by Akash from time to time (together with the Platform, the &quot;Services&quot;).
        </p>

        <p className="mb-4">
          By accessing or using any portion of the Services, or, if earlier, by clicking on an &quot;I Agree&quot; button or a check box presented with these
          Terms, you agree to comply with and be bound by these Terms and any materials expressly incorporated herein. If you do not agree, you are not
          authorized to access or use any of the Services and may not use the Services.
        </p>

        <p className="mb-4 font-bold">
          THESE TERMS INCLUDE A WAIVER OF ANY RIGHT TO PARTICIPATE IN A CLASS ACTION, AS WELL AS A MANDATORY ARBITRATION CLAUSE THAT GOVERNS RESOLUTION OF
          CERTAIN DISPUTES AND WAIVES YOUR RIGHT TO SUE IN COURT OR HAVE A TRIAL BY JURY. PLEASE READ SECTION 21 CAREFULLY.
        </p>

        <p className="mb-4 font-bold">Important Definitions: As used throughout this Agreement, the following terms have the following meanings.</p>

        <ul className="mb-4 list-disc pl-8">
          <li className="mb-2">
            <strong>&quot;Digital Asset&quot;</strong> means any cryptographic digital representation of value that functions as a medium of exchange, unit of
            account, or store of value compatible with a blockchain protocol of a computer network.
          </li>
          <li className="mb-2">
            <strong>&quot;Digital Asset Address&quot;</strong> means the alphanumeric identifier that represents a destination for a Digital Asset transaction.
          </li>
          <li className="mb-2">
            <strong>&quot;Digital Asset Wallet&quot;</strong> means a software application or other mechanism that provides a means for holding, storing,
            transferring, and receiving Digital Assets.
          </li>
          <li className="mb-2">
            <strong>&quot;Person&quot;</strong> means, without limitation, any natural person, individual, association, partnership, corporation, company, or
            other form of organization, group, or entity.
          </li>
          <li className="mb-2">
            <strong>&quot;Prohibited Jurisdictions&quot;</strong> means, any Person that is a citizen or resident or, or is located or headquartered in a
            jurisdiction where use of the Services would be illegal or violate applicable law.
          </li>
          <li className="mb-2">
            <strong>&quot;Sanctions Law&quot;</strong> means, without limitation, any export restriction, end-user restriction, antiterrorism law, anti-money
            laundering law, economic sanction, financial sanction, and trade embargo imposed, administered, or enforced by the U.S. including the U.S.
            Department of Treasury&apos;s Office of Foreign Asset Control Designated Nationals and Blocked Persons (&quot;SDN&quot;) List, U.S. Department of
            State, and U.S. Department of Commerce, the United Nations Security Council, the European Union, or any other applicable national, regional,
            provincial, state, municipal, or local law or regulation (each as amended from time to time).
          </li>
          <li className="mb-2">
            <strong>&quot;Sanctioned Person&quot;</strong> means, without limitation, any Person or Digital Asset Address that is subject to any Sanctions Law,
            or directly or indirectly owned fifty percent or more by any Person or group of Persons in the aggregate, or a Digital Asset Wallet associated with
            such Person or Persons, subject to any Sanctions Law.
          </li>
          <li className="mb-2">
            <strong>&quot;Sanctioned Jurisdiction&quot;</strong> means, without limitation, any jurisdiction comprehensively sanctioned or embargoed by the
            United States, the United Nations, the United Kingdom, or Panama, which, as of the date that these Terms were last updated: Cuba, certain sanctioned
            areas of Russia and Ukraine (including without limitation, Crimea, the so-called region of Dontesk, the so-called region of Luhansk, and the
            so-called region of Zaporizzhia), Democratic People&apos;s Republic of Korea (North Korea), Iran, and Syria.
          </li>
        </ul>

        <h2 className="mb-2 text-xl font-bold">1. The Services</h2>
        <h3 className="mb-2 text-lg font-bold">1.1 The Platform</h3>
        <p className="mb-4">
          The Platform publishes information about computing infrastructure resources, such as access to virtual machines, Kubbernetes clusters, GPU/TPU
          instances, memory, storage, and other compute resources (&quot;Resources&quot;) provided by third-party providers, which may or may not include Akash
          (&quot;Providers&quot;), and made available through the Protocol (as defined below). Subject to these Terms, users may access and use the Platform to
          lease Resources from Providers (such users, &quot;Tenants&quot;). Tenants may use the Platform to publish a request for Resources. A Provider that
          desires to fulfill the Tenant&apos;s request may submit a bid to fulfill such request on the Platform. After some time, the requesting Tenant may
          select which, if any, Provider bid that satisfies the Tenant&apos;s request. Any terms and provisions about or in connection with the Resources,
          including without limitation, technical support, are between the Tenant and the Vendor. Akash will not be responsible or liable for any Resources,
          including without limitation, technical support, security updates, or patches.
        </p>

        <h3 className="mb-2 text-lg font-bold">1.2 The Protocol</h3>
        <p className="mb-4">
          The Platform provides a web-based means to access the Akash network software protocol that runs on the Akash blockchain, a public blockchain network
          hosted by a network of unaffiliated third-party node operators whose nodes host the Akash blockchain&apos;s distributed ledger and validate and
          facilitate Digital Asset transactions performed thereon (the &quot;Protocol&quot;). The Protocol enables users to perform transactions with Digital
          Assets compatible with the underlying blockchain network. The Platform is distinct from the Protocol. The Platform is one but not the exclusive means
          of accessing the Protocol. The Protocol itself is comprised of open-source or source-available self-executing smart contracts and hosted by a network
          of unaffiliated third-party node operators whose nodes run the Protocol&apos;s software and host the Akash blockchain network. You acknowledge and
          agree that we do not control the Protocol or any Digital Assets compatible with the Protocol and we do not have control over any Digital Asset
          transactions conducted on the Protocol. You also acknowledge and agree that your interactions, including Digital Asset transactions, are not
          interactions with us. You further understand and agree that we do not operate, own, or control the Protocol&apos;s staking mechanism or governance
          mechanism, nor do we control trade execution on the Protocol.
        </p>

        <h2 className="mb-2 text-xl font-bold">2. Using the Services</h2>
        <h3 className="mb-2 text-lg font-bold">2.1 Eligibility</h3>
        <p className="mb-4">
          In connection with your access and use of the Services, you represent and warrant that you are at least 18 years old and capable of forming a binding
          contract with Akash in your respective jurisdiction. If you are accessing or using the Services on behalf of a legal entity or other type of
          organization, you represent and warrant that you are authorized to agree to these Terms on behalf of that entity or organization and represent to
          Akash that you have the power and authority to bind your legal entity or organization to these Terms. You further represent and warrant that you are
          not, and you are not acting on behalf of, a &quot;Prohibited Person,&quot; which means a: (i) Sanctioned Person; or (ii) Person that is a resident of
          or headquartered in a Sanctioned Jurisdiction or a Prohibited Jurisdiction.
        </p>

        <h3 className="mb-2 text-lg font-bold">2.2 Verification and Screening</h3>
        <p className="mb-4">
          You may be required to provide us directly, or through a third party, certain information and documentation. You represent and warrant that any
          information and documentation that you provide to us, whether as part of the Services or otherwise, is complete and accurate. We may employ various
          measures to comply with our anti-money laundering obligations and otherwise prevent the misuse of the Services. These verification and screening
          procedures may include, without limitation, checking the information you provide against sanctions lists issued by any governmental authority
          prohibiting or limiting business activities or transactions with any Person. You hereby authorize us, directly or through a third party, to make
          inquires that we consider necessary to verify your identity and/or protect against the misuse of the Services. We will have no liability or
          responsibility for any permanent or temporary inability to access or use the Services as a result of any identity verification or screening procedure.
        </p>

        <h3 className="mb-2 text-lg font-bold">2.3 User Accounts</h3>
        <p className="mb-4">
          You represent and warrant that all information you submit when you create your account is accurate, current, and complete, and that you will keep your
          account information accurate, current, and complete. You are solely responsible for any and all activity that occurs on your account, whether
          authorized by you or not, and you must keep your account information secure. You are responsible for keeping your account information up to date,
          including the information that allows you to receive any notices or alerts that we may send you. In case of a dispute about account ownership, we
          reserve the right to determine ownership to an account based on our reasonable judgment and/or our independent investigation. However, if we cannot
          make such a determination, we reserve the right to avoid doing so and/or suspend a user&apos;s account until the parties disputing such ownership,
          reach a resolution.
        </p>

        <h2 className="mb-2 text-xl font-bold">3. Digital Asset Wallets</h2>
        <h3 className="mb-2 text-lg font-bold">3.1 In General</h3>
        <p className="mb-4">
          To pay for the Services using Digital Assets, you must connect a Digital Asset Wallet. Your relationship with the Digital Asset Wallet provider is
          governed by the terms and provisions of that provider&apos;s agreement with you. By connecting your Digital Asset Wallet to the Platform, you agree to
          be bound by this Agreement. We reserve the right, in our sole discretion, to prohibit certain Digital Asset Addresses from being able to connect to
          the Platform or from accessing or using other aspects of the Services.
        </p>

        <h3 className="mb-2 text-lg font-bold">3.2 Non-Custodial</h3>
        <p className="mb-4">
          The Services are purely non-custodial applications, we do not have custody, possession, or control of your Digital Assets at any time. You own and
          control all Digital Assets held in your Digital Asset Wallet. As the owner of the Digital Assets, you bear all risk of loss of the Digital Assets.
          Akash will not be liable for Digital Asset fluctuations or other loss associated with your use of a Digital Asset Wallet.
        </p>

        <h3 className="mb-2 text-lg font-bold">3.3 Security</h3>
        <p className="mb-4">
          You are solely responsible for the custody of the cryptographic private keys associated with any Digital Asset Wallet you use or connect to the
          Services. You should never share your Digital Asset Wallet&apos;s credentials or seed phrase with anyone. We accept no responsibility or liability to
          you in connection with your use of a Digital Asset Wallet. We make no representations or warranties regarding how any of the Services will interact or
          operate with any specific Digital Asset Wallet.
        </p>

        <h2 className="mb-2 text-xl font-bold">4. Third Party Services, Applications, and Waiver</h2>
        <h3 className="mb-2 text-lg font-bold">4.1 Third Party Services</h3>
        <p className="mb-4">
          The Services may include, without limitation, links to sites, technology, applications, products, services, materials, or resources, provided or made
          available by, third a third party, including for example, Stripe (collectively, &quot;<strong>Third Party Services</strong>&quot;). Your access and
          use of any Third Party Service is subject to the terms and policies of the applicable Third Party Service provider, including without limitation,
          Stripe&apos;s Connected Account Agreement, available at https://stripe.com/legal/connect account the Stripe Terms of Service, available at
          https://stripe.com/legal/ssa and the Stripe Shop Terms of Use, available at https://stripe.com/legal/stipe-shop.
        </p>
        <p className="mb-4">
          We do not control or operate any Third Party Services. You acknowledge and agree that you are solely responsible for any and all costs and charges
          associated with your use of any Third Party Service. Our integration or inclusion of any Third Party Service does not imply endorsement or
          recommendation. You acknowledge and agree that we are not responsible for the availability, reliability, accuracy, or legitimacy of any Third Party
          Service (including any related websites, resources or links displayed therein). Any dispute you have with a Third Party Service including, without
          limitation, your intellectual property rights, is between you and the provider of that Third Party Service. Akash will not be responsible or liable
          for any damage or loss caused or alleged to be caused by, or in connection with, your use of, or reliance on, any Third Party Service.
        </p>

        <h3 className="mb-2 text-lg font-bold">4.2 Third Party Applications</h3>
        <p className="mb-4">
          If, to the extent permitted by Akash, you grant express permission to a third party to access or connect to the Services, either through a third
          party&apos;s service or the Platform, you acknowledge that granting permission to such third party to take specific actions on your behalf does not
          relieve you of any of your responsibilities under these Terms. You are fully responsible for any act or omission of any such third party. You
          acknowledge and agree that you will not hold Akash responsible for, and will indemnify Akash from, any liability arising out of or related to any act
          or omission of any third party with access to your Digital Asset Wallet, application, software, or other mechanism that you use to interact with the
          Services.
        </p>

        <h3 className="mb-2 text-lg font-bold">4.3 Waiver of Claims</h3>
        <p className="mb-4">
          To the maximum extent permitted by applicable law, you hereby waive any and all claims, demands, and damages of every kind or nature, known or
          unknown, suspected or unsuspected, disclosed or undisclosed, against Akash and its affiliates, and each of their respective officers, employees,
          agents, and successors arising out of or in any way related to any of the risks set forth herein. You also waive application of Section 1542 of the
          Civil Code of the State of California, or any similar stature or law of any other jurisdiction. Section 1542 reads as follows: &quot;a general release
          does not extend to claims which the creditor does not know or suspect to exist in his or her favor at the time of executing the release, which if
          known by him or her must have materially affected his or her settlement with the debtor.&quot;
        </p>

        <h2 className="mb-2 text-xl font-bold">5. Risk Disclosures</h2>
        <p className="mb-4">
          You understand, accept, and agree to assume all of the various risks involved in using, holding, transacting, and transferring Digital Assets and the
          use of the Services, including all of the risks set forth in this Section.
        </p>

        <ul className="mb-4 list-disc pl-8">
          <li className="mb-2">
            Digital Assets, the features, functions, characteristics, operations, use, and other properties and/or software, networks, protocols, systems, or
            other technology that Digital Assets interact with is complex, and Digital Asset terms, features, or risks may not be readily or fully understood
            due to such complexities.
          </li>
          <li className="mb-2">
            Digital Assets will be irretrievably lost if sent to the wrong Digital Asset Address. For instance, if the Digital Asset Address is improperly
            formatted, contains an error, or for a type of Digital Asset then is not supported by the Digital Asset Address&apos; underlying blockchain, then
            any Digital Assets will be irretrievably lost. Neither Akash nor any other third party is capable of reversing erroneous Digital Asset transfers or
            retrieving any lost Digital Assets transferred in error.
          </li>
          <li className="mb-2">
            The Protocol may be subject to forks or attacks on the security, integrity, and/or operation of the networks, including any network events. These
            events may affect features, functionality, operations, use, or properties of the Services and/or any Digital Asset or network and/or the value of
            any Digital Asset.
          </li>
          <li className="mb-2">
            Any Digital Asset, the Protocol, or the Services may be targeted by malicious persons or individuals who may attempt to disrupt the Services or
            steal Digital Assets. This includes but is not limited to malware, hacking, phishing, double spending, smurfing, spoofing, sybil attacks, social
            engineering, majority mining, mining attacks, distributed denial of service, and blockchain forks.
          </li>
          <li className="mb-2">
            The public nature of the internet means that parts or the internet may be unreliable or unavailable at any given time. Interruption, delay,
            corruption, loss of data, the loss of confidentiality or privacy through the course of data transmission, or malware transmission may occur when
            transmitting data via the internet or other technology. This can result in your transaction(s) not being executed according to your instructions at
            the requested time or not at all. No technology is completely secure or safe.
          </li>
          <li className="mb-2">
            Digital Assets may decrease in value or lose all value in a short period of time or permanently due to various factors including, without
            limitation, government or regulatory activity, the discovery of wrongful or illegal conduct, market manipulation, price distortion, insider dealing,
            market distortion, malicious wrongdoing or behaviors, changes to the Digital Asset&apos;s nature or characteristics, suspension, or cessation of
            support for a Digital Asset by exchanges, public opinion, technical advancements, macroeconomic and political factors, and other factors outside of
            our control.
          </li>
          <li className="mb-2">
            Digital Assets held by a decentralized application like the Protocol or Digital Asset Wallets are not protected deposits and/or may not be protected
            by any deposit protection scheme, such as the Federal Deposit Insurance Company (&quot;FDIC&quot;). Thus, Digital Assets have a reduced level and
            type of protection compared to fiat currency and other asset classes or types.
          </li>
          <li className="mb-2">
            Digital Assets are generally considered a high-risk asset class. You must exercise prudent judgment when with transacting with Digital Assets.
          </li>
          <li className="mb-2">
            The Services may undergo significant changes over time. We may also limit control over how other participants use the Services and what Services are
            offered on or through the Platform. This could create the risk of the Services not meeting your expectations, for any number of reasons, including
            mistaken assumptions or analysis, a change in the design and/or implementation plans, and execution on or through the Services.
          </li>
          <li className="mb-2">
            We currently rely on our service providers for certain aspects of our operations including: cloud computing services and data centers that provide
            facilities, infrastructure, website functionality and access, components, and services, all of which are critical to our operations. Like most other
            online companies, because we rely on service providers, we face operational risk. Any interruption in the services provided by our service providers
            can impair our ability to provide the Services to you.
          </li>
          <li className="mb-2">
            We do not directly manage the operation of the service providers we use including their data center facilities. Such third parties are vulnerable to
            financial, legal, regulatory, and labor issues, cybersecurity incidents, break-ins, computer viruses, denial-of-service attacks, sabotage, acts of
            vandalism, privacy breaches, service terminations, disruptions, interruptions, Force Majeure Events (defined below), and other events.
          </li>
          <li className="mb-2">
            You acknowledge and understand that you may be subject to scams and/or other types of fraud perpetrated by parties outside of our control. It is
            your responsibility to be aware of and protect against such misconduct. In the event that you are subject to such fraud, there is a risk of loss of
            your Digital Assets.
          </li>
          <li className="mb-2">
            All blockchain transactions include data and, in some circumstances, personal data about you. Many public blockchain networks, including the
            Protocol, store transaction data publicly and permanently. When you use such public blockchain networks, you intentionally make your transaction
            data public and acknowledge that this data cannot be deleted, removed, or reversed due to the nature of blockchain technology.
          </li>
          <li className="mb-2">
            We are subject to an extensive and rapidly evolving regulatory landscape, and any changes to any law or regulation could adversely impact our
            ability to offer the Services and/or your use or access to the Services. Such regulatory change may also impact your legal obligations with respect
            to your use of the Services.
          </li>
          <li className="mb-2">
            You understand that smart contract transactions automatically execute and settle, and blockchain-based transactions are irreversible when confirmed.
            You acknowledge and accept that the cost and speed of transacting with cryptographic and blockchain-based systems are variable and may increase
            dramatically at any time. You further acknowledge and accept the risk of selecting your slippage rate which expose you to additional cost or fees by
            the underlying blockchain network.
          </li>
          <li className="mb-2">
            You understand that we do not create, own, or operate cross-chain bridges and we do not make any representation or warranty about the safety or
            soundness of any cross-chain bridge.
          </li>
        </ul>

        <h2 className="mb-2 text-xl font-bold">6. Acknowledgements and Covenants</h2>
        <p className="mb-4">
          By accessing or using the Services, you acknowledge, represent, and warrant, in each case as applicable, each of the items contained in this Section
          and all of its subsections.
        </p>

        <h3 className="mb-2 text-lg font-bold">6.1 Acknowledgement and Assumption of Risks</h3>
        <p className="mb-4">
          You represent and warrant that you have received a copy of, have carefully read, understand, accept, and agree to assume all of the risks involved in
          using, holding, trading, delivering, transacting, and/or transferring Digital Assets and the use of the Services, including without limitation, the
          risks specifically set forth in these Terms. You agree that Akash shall not be liable to you for any loss, damage, expense, or liability that are or
          may relate to any of the risks specifically set forth herein. Further, you represent that you are able to bear any financial or other loss associated
          with or that may otherwise relate to your access or use of the Services.
        </p>

        <h3 className="mb-2 text-lg font-bold">6.2 Non-Reliance</h3>
        <p className="mb-4">
          You represent that you are not relying on (and will not at any time rely on) any communication (written or oral) of Akash as advice or as a
          recommendation to engage in any transaction involving Digital Assets. Further, you confirm that Akash has not: (a) given any guarantee or
          representation as to the potential success, return, effect, or benefit (either legal, regulatory, tax, financial, accounting, or otherwise) of
          transacting in Digital Assets; or (b) made any representation to you regarding the legality of transacting in Digital Assets under any applicable law
          to which you may be subject. In deciding to use the Services to transact in Digital Assets, you are not relying on the advice or recommendations of
          Akash, and you have made your own independent decision that using the Services and transacting in Digital Assets are suitable and appropriate for you.
        </p>
        <p className="mb-4">
          You acknowledge and agree that we do not provide investment advice, and any content on the Platform, other parts of the Services, or communication
          channels should not be considered as investment advice. You must seek professional advice regarding your particular financial, legal, technical, and
          other conditions prior to commencing your use of the Services. You represent and warrant that you fully understand all risks associated with using the
          Services and you have the necessary experience, understanding, and risk tolerance for using the Services, including the necessary experience and
          knowledge to enter into any relevant transaction through the Services. You will carefully consider and use clear judgment to evaluate your financial
          situation and risks before making any decisions to use the Services. You accept the risk of using the Services and are responsible for conducting your
          own independent analysis of the risks specific to your use of the Services.
        </p>

        <h2 className="mb-2 text-xl font-bold">7. Prohibited Use</h2>
        <p className="mb-4">
          You may not use the Services to engage in the following categories of activity (each a &quot;Prohibited Use&quot;). The specific types of activities
          listed below are representative, but not exhaustive.
        </p>

        <ul className="mb-4 list-disc pl-8">
          <li className="mb-2">
            <strong>Unlawful Activity.</strong> Activity which, in any way, would violate, or assist in violation of, any law, statue, ordinance, or regulation,
            sanctions programs administered in the countries where Akash offers the Services, or which would involve proceeds of any unlawful activity,
            including without limitation publishing, distributing, or disseminating any unlawful material or information.
          </li>
          <li className="mb-2">
            <strong>Abusive of Others.</strong> Interfere with another individual&apos;s access to or use of the Services including without limitation any
            activity that may: exploit, harm, or attempt to exploit or harm minors in any way by exposing them to inappropriate content: defame, abuse, extort,
            harass, stalk, threaten, or otherwise violate or infringe the legal rights of others; ask for personally identifiable information, or otherwise
            transmit, or procure the sending of, any advertising or promotional material, including any &quot;junk mail,&quot; &quot;chain letter,&quot;
            &quot;spam,&quot; or any other similar solicitation; impersonate or attempt to impersonate Akash, an employee, another user, or any other person or
            entity associated with Akash (including, without limitation, by using email addresses, screen names, similarly named or commonly misspelled URLs, or
            associated blockchain identities); engage in any other conduct that restricts or inhibits anyone&apos;s use or enjoyment of the Services; or incite,
            threaten, encourage, or promote hate, racial intolerance, or violent acts against others.
          </li>
          <li className="mb-2">
            <strong>Fraud.</strong> Activity which operates to deceive or defraud, or attempt to deceive or defraud, Akash, any users or any other person,
            including without limitation providing any false, inaccurate, or misleading information whether directly through the Services or through an external
            means that affects the Services with the intent to unlawfully obtain the property of another or to provide knowingly or recklessly false
            information, including without limitation in any way that causes inaccuracy among the content on the Services.
          </li>
          <li className="mb-2">
            <strong>Abusive Activity.</strong> Activity that may cause the Services, the Services underlying blockchain networks or technologies, or any other
            functionality with which the Services interact, to work other than as intended; damage the reputation of Akash or impair any of our legal rights or
            interests; violate any applicable laws concerning, or otherwise damages, the integrity of the Services, or any other service or software which
            relies on the Services; disable, overburden, damage, impair, or interfere with the Services, including the ability to engage in real time activities
            through the Services; involve the use any robot, spider, or other automatic device, process, or means to access the Services for any purpose,
            including monitoring or copying any of the material on the Services; attempt to gain unauthorized access to, interfere with, damage, or disrupt any
            parts of the Services, the server on which the Services or information in connection with the Services is stored, or any server, computer, or
            database connected to the Services, including any underlying blockchain.
          </li>
          <li className="mb-2">
            <strong>Intellectual Property Infringement.</strong> Violate the legal rights (including the rights of publicity and privacy) of others or contain
            any material that could give rise to any civil or criminal liability under applicable law or regulation or that otherwise may be in conflict with
            these Terms; engage in transactions involving items that infringe or violate any copyright, trademark, right of publicity or privacy, or any other
            proprietary right under the law, including but not limited to sales, distribution, or access to counterfeit music, software, or other licensed
            materials without the appropriate authorization from the rights holder; use of Akash intellectual property, name, or logo, including use of any
            Akash trade or service mark, without express consent of Akash or in a manner that otherwise harms Akash or the Akash brand; any action that implies
            an untrue endorsement by or affiliation with Akash.
          </li>
        </ul>

        <p className="mb-4">
          You agree and represent that you will not engage in any Prohibited Use in connection with the Services. You further represent and warrant that you:
          (a) will abide by any and all applicable laws of the jurisdiction where you are located while using the Platform or the Services; (b) will comply with
          all local, national, and international practices regarding internet use; (c) have obtained sufficient information about the Services, Digital Assets,
          and other services or products in connection with the Services to make an informed decisions in regard to your use of the Services; (d) will bear the
          full responsibility for any and all activities that occurs in connection with your use or access to the Services including without limitation
          transactions of Digital Assets, interacting with the Services, disclosing, or publishing information, clicking to agree with various agreements, and
          uploading and submitting various documents or information; and (e) are the legal and rightful owner of the Digital Assets in the Digital Asset Wallet,
          and Digital Assets you use with the Services.
        </p>

        <h2 className="mb-2 text-xl font-bold">8. Sanctions & Export Controls</h2>
        <p className="mb-4">
          You may not use the Services or purchase any Resources in or for the benefit of a country, organization, entity, or person embargoed or blocked by any
          government, including those on sanctions lists identified by OFAC. We do not claim, and we cannot guarantee that the Services or any Resources are or
          will be appropriate or available for any location or jurisdiction, comply with the laws of any location or jurisdiction, or comply with laws governing
          export, import, or foreign use.
        </p>

        <h2 className="mb-2 text-xl font-bold">9. Changes, Suspension, and Termination</h2>
        <p className="mb-4">
          Akash may, at its discretion and without liability to you, with or without prior notice and at any time, modify, discontinue, temporarily, or
          permanently, all or any portion of the Platform. You acknowledge that our decision to take certain actions, including limiting access to, suspending,
          or terming your access to the Platform may be based on our confidential criteria that are essential to our risk management and security protocols. You
          agree that we are under no obligation to disclose the details of our risk management and security procedures to you. Akash will not be liable for any
          losses suffered by you resulting from any modification of the Services or from any suspension or termination of your access to all or a portion of the
          Platform (whether pursuant to this Section 9 or for any other reason. You acknowledge that Digital Asset values may fluctuate during any period during
          which the Services have been suspended and agree that Akash will have no liability for any such fluctuations.
        </p>

        <p className="mb-4">
          Without limiting the foregoing, we have the right to cooperate fully with any law enforcement authorities or court order requesting or directing us to
          disclose the identity or other information of anyone posting any materials on or through the Services. You waive and hold harmless Akash and its
          affiliates, licensees, and service providers from any claims resulting from any action taken by Akash and/or any of the foregoing parties during, or
          taken as a consequence of, investigations by us, such parties, or law enforcement authorities.
        </p>

        <h2 className="mb-2 text-xl font-bold">10. Intellectual Property Rights</h2>
        <h3 className="mb-2 text-lg font-bold">10.1 Akash Materials</h3>
        <p className="mb-4">
          The Services and its entire contents, features, and functionality including but not limited to all information, software, text, displays, images,
          video, and audio, the design, selection, and arrangement thereof, and the &quot;look and feel&quot; of the Services, except any open source software,
          are owned by Akash (&quot;Akash Materials&quot;), its licensors, or other providers of such material and are protected by applicable and/or
          international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.
        </p>

        <h3 className="mb-2 text-lg font-bold">10.2 Limitations on Use</h3>
        <p className="mb-4">
          In connection with your use of the Services, you may use the Akash Materials solely as authorized by us for as long as we permit you to continue
          accessing the Services. Without limiting the foregoing, you agree not to: (a) resell, lease, lend, share, distribute, or otherwise permit any third
          party to use the Services, Akash Materials, or use the Services or Akash Materials in any service bureau environment; (b) modify or create derivative
          works of the Services or Akash Materials, or any portion thereof, or any data or information received by you in connection therewith; (c) frame,
          display, or incorporate the Services or Akash Materials in any website or any other work of authorship in a manner that implies any affiliation with
          Akash other than of your use of the Services; (d) decompile, disassemble, reverse engineer, or attempt to discover the source code of the Services or
          Akash Materials; (e) use the Services or Akash Materials to design, develop, or create any competing product or service; or (f) otherwise use the
          Services or Akash Materials for any commercial or noncommercial purpose other than their intended purposes determined at Akash&apos;s discretion.
        </p>

        <h3 className="mb-2 text-lg font-bold">10.3 Rights We Grant You</h3>
        <p className="mb-4">
          We hereby permit you to use and access the Services, provided that you comply with these Terms. If any software, content, or other materials owned or
          controlled by us are distributed to you as part of your use of the Services, we hereby grant you a non-sublicensable, non-transferable, and
          non-exclusive right and license to execute, access, and display such software, content, and materials provided to you as part of the Services, in each
          case for the sole purpose of enabling you to use the Services as permitted by these Terms.
        </p>

        <h3 className="mb-2 text-lg font-bold">10.4 Reservation of Rights</h3>
        <p className="mb-4">
          If your use or access to the Services is in breach of these Terms, your right to access the Services will stop immediately and you must, at our sole
          option, return or destroy any copies of the materials that you made directly or indirectly from the Services. No right, title, or interest in or to
          the Services is transferred to you, and all rights not expressly granted are reserved by Akash. You may freely use any open-sourced materials up to
          the limits provided, but in accordance with any requirements placed, by those materials&apos; open-source licenses. Any use of the Services not
          expressly permitted by these Terms is a breach of these Terms and may violate copyright, trademark, and other applicable laws.
        </p>

        <h3 className="mb-2 text-lg font-bold">10.5 Trademarks</h3>
        <p className="mb-4">
          Akash&apos;s name, the term &quot;Akash Network&quot; and all related names, logos, product and/or service names, designs, and slogans are trademarks
          of Akash, its affiliates, or licensors. You agree not to use such marks without the prior express written permission of Akash.
        </p>

        <h2 className="mb-2 text-xl font-bold">11. Platform Content</h2>
        <p className="mb-4">
          We do not warrant the accuracy, completeness, or usefulness of any materials or information that we or a third party present on or through the
          Services. Such information is made available solely for general information and education purposes. Any information posted to the Services should not
          be construed as an intention to form a contract, and in no case should any information be construed as our offer to buy, sell, exchange, or otherwise
          transact Digital Assets. We disclaim all liability and responsibility arising from any reliance placed on such information or materials by you, any
          other user or person who may be informed of any of the Services contents, or by the actions or omissions of others interacting with the Services.
        </p>

        <h2 className="mb-2 text-xl font-bold">12. Interactions with other Users</h2>
        <p className="mb-4">
          You are responsible for your interactions with other users, including other Tenants or Providers, as applicable, on or through the Services. While we
          reserve the right to monitor interactions between users, we are not obligated to do so, and we cannot be held liable for your interactions with other
          users, or for any user&apos;s actions or inactions. If you have a dispute with one or more users, now or in the future, you agree to release Akash
          (and our affiliates and subsidiaries, and our and their respective officers, directors, employees, and agents) from claims, demands, and damages
          (actual and consequential) of every kind and nature, known and unknown, arising out of or in any way connected with such disputes. In entering this
          release, you expressly waive any protections (whether statutory or otherwise) that would otherwise limit the coverage of this release to include only
          those claims which you may know or suspect to exist in your favor at the time of agreeing to this release.
        </p>

        <h2 className="mb-2 text-xl font-bold">13. Promotions</h2>
        <p className="mb-4">
          Akash may make available special offers or conduct promotions for qualifying users. Subject to applicable laws, Akash, or the issuer of a Digital
          Asset subject to an offer or promotion, may establish qualifying criteria to participate in any special promotions at its sole discretion. Any
          benefits associated with any promotions are limited to one per user. Akash may revoke any special offer at any time and for any reason without advance
          notice to you. Akash is under no obligation to make available special offers to all Akash users. Akash makes no recommendation and does not provide
          any advice about the value or utility of a Digital Asset that is part of a promotion.
        </p>

        <h2 className="mb-2 text-xl font-bold">14. Feedback</h2>
        <p className="mb-4">
          Any questions, suggestions, ideas, feedback, reviews, or other information or materials regarding the Services provided by you to Akash (collectively,
          &quot;Feedback&quot;) are non-confidential. Akash will be entitled to the unrestricted use and dissemination of Feedback for any purpose, commercial
          or otherwise without acknowledgment, attribution, or compensation to you. You hereby assign to Akash all right, title, and interest to Feedback
          together with all associated intellectual property rights and waive any claim for, acknowledgement or compensation based on any Feedback or any
          modifications made based on any Feedback.
        </p>

        <h2 className="mb-2 text-xl font-bold">15. Relationship of the Parties</h2>
        <p className="mb-4">
          Akash is not your broker, intermediary, agent, or advisor and has no fiduciary relationship or obligation to you in your use of the Services. Akash
          does not provide investment, tax, or legal advice, and you are solely responsible for any transaction, investment, strategy, decision, or other act
          that you make when using the Services. Akash may provide educational material or information on the Platform, through the Services, social media
          account, or other channel of communication. No communication or information provided to you by Akash is intended as, or shall be considered or
          construed as, advice. To the fullest extent permissible by law, you agree that your access or use of the Services causes Akash or any user to owe
          fiduciary duties or liabilities to you or any third party. Further, you acknowledge and agree to the fullest extent such duties or liabilities are
          afforded by law or by equity, those duties and liabilities are hereby irrevocably disclaimed, waived, and eliminated, and that Akash shall be held
          completely harmless in relation thereof.
        </p>

        <h2 className="mb-2 text-xl font-bold">16. Charges and Fees</h2>
        <h3 className="mb-2 text-lg font-bold">16.1 Protocol Fees</h3>
        <p className="mb-4">
          You may be charged fees in connection with your access to the Protocol via a third party interface. You are responsible for doing your own diligence
          on any third party interface to understand any applicable fee or charge that such third party may charge you. Under no circumstances shall Akash incur
          any liability, of any kind, to you arising from or relating to fees charged to you by your access or use to the Protocol via a third party interface.
        </p>
        <p className="mb-4">You may cancel your access to the Services at any time through the Platform.</p>

        <h3 className="mb-2 text-lg font-bold">16.2 Our Charges and Fees</h3>
        <p className="mb-4">
          We may, in our sole discretion and at any time, set or modify the fees for the Services. If we decide to set or modify fees for the Services, the fee
          schedule will be made available on the Platform. Except when required by law, all fees you pay to us are non-refundable.
        </p>

        <h3 className="mb-2 text-lg font-bold">16.3 Blockchain Fees</h3>
        <p className="mb-4">
          Blockchain transactions require the payment of transaction fees to the appropriate network&apos;s nodes, miners, validators, or operators
          (&quot;Blockchain Fees&quot;). You will be solely responsible to pay the Blockchain Fees for any transaction that you initiate via the Protocol or the
          Services. Blockchain Fees are neither levied directly by Akash nor paid to or shared with Akash in any way, but rather are determined by your use of
          the Protocol and the rules placed by corresponding blockchain communities at large. You acknowledge and agree that Akash has no control over
          Blockchain Fees (including without limitation their applicability, payment, amounts, transmission, intended operation, and effectiveness) whether
          related to your use of the Services or otherwise, and in no event will Akash be responsible to you or any other party for the payment, repayment,
          refund, disbursement, indemnity, or for any other aspect of your use or transmission of Blockchain Fees.
        </p>

        <h3 className="mb-2 text-lg font-bold">16.4 Credit Card Payments; Chargebacks</h3>
        <p className="mb-4">
          You may purchase access to the Services with Digital Assets via your Digital Asset Wallet, or with an accepted debit or credit card (&quot;Payment
          Card&quot;) through Stripe&apos;s payment portal. You are responsible for keeping all information for your Payment Card updated and accurate through
          the term of this Agreement.
        </p>
        <p className="mb-4">
          When you purchase access to the Services with a Payment Card, a Digital Asset Wallet associated with and controlled by your account will be created
          automatically and the amount of your payment will be converted to Axelar USDC stablecoins, a Digital Asset issued by a third party intended to
          maintain 1:1 price parity with the U.S. dollar (&quot;axlUSDC&quot;). Prices for Services are determined by Providers. The prices of the available
          Services are determined by Providers and not by Akash. Applicable Blockchain Fees associated with your use of the Services will be charged
          automatically against your axlUSDC balance. Delivery of access to the Services is performed solely by the Provider upon your successful payment to
          such Provider. You are responsible for keeping all information for your Payment Card updated and accurate. The U.S. Dollar equivalent price of axlUSDC
          is determined by a third party, not us. We make no representations, warranties, or guarantees of any kind regarding the stability or price volatility
          associated with axlUSDC. Your use of a Payment Card to access the Services is solely at your own risk. YOU AGREE THAT ALL SALES TO YOU OF axlUSDC ARE
          FINAL. TO THE FULLEST EXTENT PERMITTED UNDER APPLICABLE LAW, NO REFUNDS WILL BE GIVEN.
        </p>
        <p className="mb-4">
          Any and all axlUSDC you convert, use, purchase, and/or transact, which may be held on your account or transmitted to a Digital Asset Wallet address,
          are not stored or held in an electronic money account and does not qualify as a &quot;deposit&quot;; axlUSDC are not a representation of money or
          funds. By accepting the terms of this Agreement, you acknowledge and agree that your axlUSDC are not protected by any deposit guarantee scheme and the
          funds used to increase your axlUSDC will not be safeguarded. Your axlUSDC belong to you and no other person has any rights to your axlUSDC.
        </p>
        <p className="mb-4">
          Notwithstanding the foregoing, we will facilitate &quot;Chargebacks&quot; for any successfully disputed fees paid in connection the Services if
          directed by Stripe. A &quot;Chargeback&quot; occurs when a credit card payment is reversed by your card issuer or payment provider, typically due to a
          dispute, fraud claim, or unauthorized transaction. Chargebacks are subject to Stripe&apos;s terms and conditions found here:
          https://support.stripe.com/topics/cash-titles.
        </p>

        <h2 className="mb-2 text-xl font-bold">17. General Service Terms</h2>
        <h3 className="mb-2 text-lg font-bold">17.1 Blockchain Transactions</h3>
        <p className="mb-4">
          In connection with the Services, transactions rely on blockchain software parameters, cryptographic tokens generated by such parameters, and other
          nascent software, applications and systems that interact with blockchain-based networks. These technologies are experimental, speculative, inherently
          risky, and subject to change. A defining feature of blockchain technology is that its entries are immutable, which means, as a technical matter, they
          generally cannot be deleted or modified by anyone. You acknowledge and understand that smart contracts dictate how funds and ownership of Digital
          Assets are distributed.
        </p>

        <h3 className="mb-2 text-lg font-bold">17.2 Taxes</h3>
        <p className="mb-4">
          It is your sole responsibility to determine whether and to what extent any taxes apply to activity you conduct through the Services, and to withhold,
          collect, report, and remit the correct amounts of taxes to the appropriate tax authorities. No communication or information provided to you by Akash
          is intended as, or considered or construed as, legal or tax advice.
        </p>

        <h2 className="mb-2 text-xl font-bold">18. WARRANTY DISCLAIMER</h2>
        <p className="mb-4 font-bold">
          Akash has no oversight on or control over any particular Digital Asset or blockchain network, including the Protocol. You are responsible for your use
          of the Services, the functionalities that you enable, transactions engaged on the Protocol through the Services, and access or use of the information
          derived thereof. You are solely responsible for complying with all applicable laws related to its transactions and activities that directly or
          indirectly incorporate our provision of the Services. You acknowledge and understand Akash is not registered nor licensed with, nor have the Services
          or the software contained therein been reviewed by any securities, commodities, or other financial or banking regulator. You further understand that
          we cannot and do not guarantee or warrant that files available for download from the Services will be free of viruses or other destructive code. You
          are responsible for implementing sufficient procedures and checkpoints to satisfy your particular requirements for: (a) an appropriate
          blockchain-based utility; (b) anti-virus protection and accuracy of data input and output; (c) your participation in and use of the Protocol and
          related technologies; and (d) maintaining a means external to our site to reconstruct any lost data.
        </p>

        <p className="mb-4 font-bold">
          TO THE FULLEST EXTENT PROVIDED BY LAW, IN NO EVENT WILL AKASH, ITS AFFILIATES, SERVICE PROVIDERS, OR ANY OF THEIR RESPECTIVE OFFICERS, DIRECTORS,
          AGENTS, JOINT VENTURERS, EMPLOYEES, OR REPRESENTATIVES BE LIABLE FOR ANY LOSS OR DAMAGE CAUSED BY A DISTRIBUTED DENIAL-OF-SERVICE ATTACK,
          MAN-IN-THE-MIDDLE ATTACK, VIRUS, OR OTHER TECHNOLOGICALLY HARMFUL MATERIAL THAT MAY INFECT YOUR COMPUTER EQUIPMENT, COMPUTER PROGRAMS, DATA, OR OTHER
          PROPRIETARY MATERIAL DUE TO YOUR USE OF THE SERVICES, THE PROTOCOL, THE AKASH MATERIALS, OR ANY PRODUCT, SERVICE OR OTHER ITEM PROVIDED BY OR ON
          BEHALF OF AKASH THROUGH THE SERVICES, OR YOUR DOWNLOADING OF ANY MATERIAL POSTED ON IT, OR ON ANY THIRD PARTY WEBSITE LINKED TO IT.
        </p>

        <p className="mb-4 font-bold">
          YOUR USE OF THE SERVICES AND ANY SERVICES CONTENT IS AT YOUR SOLE RISK. THE SERVICES, THE AKASH MATERIALS, THE PROTOCOL, AND ANY PRODUCT, SERVICE OR
          OTHER ITEM PROVIDED BY OR ON BEHALF OF AKASH ARE PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS. TO THE FULLEST EXTENT LEGALLY
          PERMISSIBLE, IN NO EVENT WILL AKASH, ITS AFFILIATES, SERVICE PROVIDERS, OR ANY OF THEIR RESPECTIVE OFFICERS, DIRECTORS, AGENTS, JOINT VENTURERS,
          EMPLOYEES, OR REPRESENTATIVES BE LIABLE FOR, AND EXPLICITLY DISCLAIM, ANY AND ALL REPRESENTATIONS OR WARRANTIES OF ANY KIND RELATED THE SERVICES, THE
          AKASH MATERIALS, THE PROTOCOL, OR ANY PRODUCT, SERVICE OR OTHER ITEM PROVIDED BY OR ON BEHALF OF AKASH WHETHER EXPRESS, IMPLIED, OR STATUTORY,
          INCLUDING (WITHOUT LIMITATION) THE WARRANTIES OF MERCHANTABILITY, NON-INFRINGEMENT, AND FITNESS FOR A PARTICULAR PURPOSE. NEITHER AKASH, ITS
          AFFILIATES, SERVICE PROVIDERS, OR ANY OF THEIR RESPECTIVE OFFICERS, DIRECTORS, AGENTS, JOINT VENTURERS, EMPLOYEES, OR REPRESENTATIVES MAKES ANY
          WARRANTY OR REPRESENTATION WITH RESPECT TO THE COMPLETENESS, SECURITY, RELIABILITY, QUALITY, ACCURACY, OR AVILABILITY OF THE SERVICES, THE AKASH
          MATERIALS, THE PROTOCOL, AND/OR ANY PRODUCT, SERVICE OR OTHER ITEM PROVIDED BY OR ON BEHALF OF AKASH.
        </p>

        <p className="mb-4 font-bold">
          AKASH, ITS AFFILIATES, SERVICE PROVIDERS, OR ANY OF THEIR RESPECTIVE OFFICERS, DIRECTORS, AGENTS, JOINT VENTURERS, EMPLOYEES, OR REPRESENTATIVES DO
          NOT REPRESENT OR WARRANT THAT: (A) ACCESS TO THE SERVICES, THE AKASH MATERIALS, THE PROTOCOL, OR ANY PRODUCT, SERVICE OR OTHER ITEM PROVIDED BY OR ON
          BEHALF OF AKASH WILL BE CONTINUOUS, UNINTERRUPTED, TIMELY, WITHOUT DELAY, ERROR-FREE, SECURE, OR FREE FROM DEFECTS; (B) THE INFORMATION CONTAINED OR
          PRESENTED ON THE SERVICES, THE AKASH MATERIAL, OR THE PROTOCOL IS ACCURATE, RELIABLE, COMPLETE, CONCISE, CURRENT, OR RELEVANT; (C) THE SERVICES, THE
          AKASH MATERIALS, THE PROTOCOL, OR ANY PRODUCT, SERVICE OR OTHER ITEM PROVIDED BY OR ON BEHALF OF AKASH OR ANY SOFTWARE CONTAINED THEREIN WILL BE FREE
          FROM DEFECTS, MALICIOUS SOFTWARE, ERRORS, OR ANY OTHER HARMFUL ELEMENTS, OR THAT ANY OF SUCH WILL BE CORRECTED; OR (D) THE SERVICES, THE AKASH
          MATERIALS, OR ANY PRODUCT, SERVICE OR OTHER ITEM PROVIDED BY OR ON BEHALF OF AKASH WILL MEET ANY USER&apos;S EXPECTATIONS.
        </p>

        <p className="mb-4 font-bold">
          NO INFORMATION OR STATEMENT THAT WE MAKE, INCLUDING DOCUMENTATION OR PRIVATE COMMUNICATION, SHOULD BE TREATED AS OFFERING ANY WARRANTY CONCERNING THE
          SERVICES, THE AKASH MATERIALS, THE PROTOCOL, OR ANY PRODUCT, SERVICE OR OTHER ITEM PROVIDED BY OR ON BEHALF OF AKASH. WE DO NOT ENDORSE, GUARANTEE, OR
          ASSUME ANY LIABILITY OR RESPONSIBILITY FOR ANY CONTENT, ADVERTISEMENTS, OFFERS, STATEMENTS, OR ACTIONS BY ANY THIRD PARTY EITHER REGARDING THE
          SERVICES, THE AKASH MATERIALS, THE PROTOCOL, OR ANY PRODUCT, SERVICE OR OTHER ITEM PROVIDED BY OR ON BEHALF OF AKASH. THE FOREGOING DOES NOT AFFECT
          ANY WARRANTIES THAT CANNOT BE EXCLUDED OR LIMITED UNDER APPLICABLE LAW.
        </p>

        <h2 className="mb-2 text-xl font-bold">19. Indemnification</h2>
        <p className="mb-4">
          You agree to defend, indemnify, and hold harmless Akash, its affiliates, licensors, service providers, and their respective officers, directors,
          employees, contractors, agents, licensors, suppliers, successors, and assigns from and against any claims, liabilities, damages, judgments, awards,
          losses, costs, expenses, or fees (including reasonable attorneys&apos; fees) arising out of or relating to; (a) your violation of these Terms; (b)
          your use of Services, including, but not limited to, your interactions with the Platform or other services or features accessible or or through the
          Services; (c) use of or reliance on the Platform&apos;s content, the Services, and/or services or products other than as expressly authorized in these
          Terms; (d) your use or reliance on of any information obtained from the Services, and/or (e) any third party&apos;s access or use of the Services with
          or without your assistance, using any device, account, profile, Digital Asset Wallet, or other mechanism that you own or control.
        </p>

        <h2 className="mb-2 text-xl font-bold">20. LIMITATION OF LIABILITY; DISCLAIMER OF DAMAGES</h2>
        <p className="mb-4 font-bold">
          TO THE FULLEST EXTENT PROVIDED BY LAW, IN NO EVENT WILL AKASH, ITS AFFILIATES, OR THEIR RESPECTIVE LICENSORS, SERVICE PROVIDERS, EMPLOYEES, AGENTS,
          OFFICERS, OR DIRECTORS BE LIABLE FOR DAMAGES OF ANY KIND, UNDER ANY LEGAL THEORY, ARISING OUT OF OR IN CONNECTION WITH YOUR USE, OR INABILITY TO USE
          THE SERVICES, THE AKASH MATERIALS, THE PROTOCOL, OR ANY PRODUCT, SERVICE OR OTHER ITEM PROVIDED BY OR ON BEHALF OF AKASH, INCLUDING ANY DIRECT,
          INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES INCLUDING BUT NOT LIMITED TO, PERSONAL INJURY, PAIN AND SUFFERING, EMOTIONAL
          DISTRESS, LOSS OF REVENUE, LOSS OF PROFITS, LOSS OF BUSINESS OR ANTICIPATED SAVINGS, LOSS OF USE, LOSS OF GOODWILL, LOSS OF DATA, AND WHETHER CAUSED
          BY TORT (INCLUDING NEGLIGENCE), BREACH OF CONTRACT, OR OTHERWISE, EVEN IF FORESEEABLE. THIS DISCLAIMER OF LIABILITY EXTENDS TO ANY AND ALL DAMAGES
          CAUSED BY ANY THIRD PARTY (INCLUDING, WITHOUT LIMITATION, THOSE CAUSED BY FRAUD, DECEIT, OR MANIPULATION), WHETHER OR NOT A USER, OR ANY FAILURE,
          EXPLOIT, OR VULNERABILITY OF THE SERVICES, THE PLATFORM, THE PROTOCOL, THE AKASH MATERIALS, OR ANY PRODUCT, SERVICE OR OTHER ITEM PROVIDED BY OR ON
          BEHALF OF AKASH.
        </p>

        <p className="mb-4 font-bold">
          TO THE FULLEST EXTENT PROVIDED BY LAW, IN NO EVENT WILL THE COLLECTIVE LIABILITY OF AKASH, ITS SUBSIDIARIES, AFFILIATES, LICENSORS, SERVICE PROVIDERS,
          AND THEIR RESPECTIVE EMPLOYEES, AGENTS, OFFICERS, AND DIRECTORS, TO ANY PARTY (REGARDLESS OF THE FORM OF ACTION, WHETHER IN CONTRACT, TORT, OR
          OTHERWISE) EXCEED THE GREATER OF $100 OR THE AMOUNT YOU HAVE PAID DIRECTLY TO AKASH FOR THE APPLICABLE SERVICES IN THE LAST SIX MONTHS OUT OF WHICH
          LIABILITY AROSE. THE FOREGOING DOES NOT AFFECT ANY LIABILITY THAT CANNOT BE EXCLUDED OR LIMITED UNDER APPLICABLE LAW.
        </p>

        <h2 className="mb-2 text-xl font-bold">21. Dispute Resolution, Waiver of Class Action, and Mandatory Arbitration</h2>
        <p className="mb-4">
          Please read this section carefully because it waives any right to participate in any class action or other representative action or proceeding. This
          section requires you to arbitrate certain disputes and limits the ways in which you can seek relief, including by precluding you from suing in court
          or having a jury trial.
        </p>

        <h3 className="mb-2 text-lg font-bold">21.1 Waiver of Class Actions and Right to Jury Trial</h3>
        <p className="mb-4">
          To the extent permissible by law, any claim, controversy, or dispute arising out of or related to this Agreement, or any products or services provided
          in connection with the Services (each a &quot;Dispute&quot;) must be brought in your individual capacity, and not as a plaintiff or class member in
          any putative class, collective action, or representative proceeding (collectively, a &quot;Class Action Waiver&quot;). The arbitrator may not
          consolidate more than one person&apos;s claims or engage in any arbitration on behalf of a class. You agree that, by entering into this agreement, you
          are waiving the right to a trial by jury and the right to participate in a class action.
        </p>

        <h3 className="mb-2 text-lg font-bold">21.2 Informal Resolution</h3>
        <p className="mb-4">
          Before filing a claim against Akash, you agree to try to resolve the Dispute by first emailing{" "}
          <Link href="mailto:consolebilling@akash.network" target="_blank" rel="noopener noreferrer">
            consolebilling@akash.network
          </Link>{" "}
          with a description of your claim and proof of your relationship with Akash. If we can&apos;t resolve the Dispute within sixty days of our receipt of
          your first email, you or Akash may then submit the Dispute to binding arbitration as provided herein.
        </p>

        <h3 className="mb-2 text-lg font-bold">21.3 Arbitration Agreement</h3>
        <p className="mb-4">
          With only limited exceptions as described in 21.7 below, all Disputes between you and Akash must be resolved by final and binding arbitration. By
          agreeing to binding arbitration, you and Akash expressly waive the right to formal court proceedings including without limitation trial by jury and
          class action. This Agreement affects interstate commerce, and the enforceability of this Section will be substantively and procedurally governed by
          the Federal Arbitration Act 9 U.S.C. § 1, et seq. (&quot;FAA&quot;).
        </p>

        <h3 className="mb-2 text-lg font-bold">21.4 Conducting Arbitration</h3>
        <p className="mb-4">
          The arbitration shall be conducted by the International Chamber of Commerce (&quot;ICC&quot;) under its Commercial Arbitration Rules (&quot;ICC
          Rules&quot;) then in effect. If you are a consumer, the most recent version of the ICC Rules can be accessed{" "}
          <Link
            href="https://iccwbo.org/dispute-resolution/dispute-resolution-services/arbitration/rules-procedure/2021-arbitration-rules/"
            target="_blank"
            rel="noopener noreferrer"
          >
            here
          </Link>
          . These Terms shall govern any conflict between the ICC Rules and these Terms. The location and type of hearing shall be determined in accordance with
          the ICC Rules. Further, a party&apos;s right to request a hearing shall also be determined in accordance with the ICC Rules. Unless otherwise ordered
          by an arbitrator or pursuant to the ICC Rules, any in-person arbitration shall be in English and administered in New York, New York, or another
          mutually agreeable location.
        </p>

        <h3 className="mb-2 text-lg font-bold">21.5 Confidentiality</h3>
        <p className="mb-4">
          Akash, the arbitrator, and you, will each maintain the confidentiality of any arbitration proceedings, judgments, and awards including information
          gathered and produced during the arbitration.
        </p>

        <h3 className="mb-2 text-lg font-bold">21.6 Arbitration Time for Filing</h3>
        <p className="mb-4">
          Any arbitration must be commenced by filing a demand for arbitration within one year after the date the party asserting the claim first knows or
          reasonably should know of the act, omission or default giving rise to the claim. If applicable law prohibits a one year limitation period for
          asserting claims, any claim must be asserted within the shortest time period permitted by applicable law. If a claim is not filed within such period,
          the Dispute is permanently barred.
        </p>

        <h3 className="mb-2 text-lg font-bold">21.7 Excepted Claims</h3>
        <p className="mb-4">
          Notwithstanding this Section 21, you and Akash may bring an individual small claims action in the small claims court in your or Akash&apos;s
          respective county of residence as provided under the ICC Rules, or seek only a temporary restraining order or injunction for alleged breach of
          confidentiality obligations or alleged infringement or misappropriation of intellectual property in any court having jurisdiction provided that, in
          each case, the action is brought as an individual action and not on a class or representative basis.
        </p>

        <h3 className="mb-2 text-lg font-bold">21.8 Severability</h3>
        <p className="mb-4">
          If any portion of this Section 21 is found to be unenforceable or unlawful for any reason, the unenforceable or unlawful provision shall be severed
          from these Terms and such severance of the provision(s) shall have no impact whatsoever on the remainder of this Section 21. Further, to the extent
          that any claims must therefore proceed on a class, collective, consolidated, or representative basis, such claims must be litigated in a civil court
          of competent jurisdiction and not in arbitration, and the parties agree that litigation of those claims shall be stayed pending the outcome of any
          individual claims in arbitration. Lastly, if any provision in this Section 21 is found to prohibit an individual claim seeking public injunctive
          relief, such provision shall have no effect to the extent relief is allowed to be sought outside of arbitration. The remainder of this Section 21
          shall remain in full force and effect.
        </p>

        <h3 className="mb-2 text-lg font-bold">21.9 Modification</h3>
        <p className="mb-4">
          Notwithstanding any term or provision in this Agreement to the contrary, you and Akash agree that if Akash makes any future material change to this
          Section 21, Akash will notify you. Your continued use of the Services including the acceptance of products and services offered on the Platform
          following the posting of changes to this Section 21 constitutes your acceptance of any such changes.
        </p>

        <h2 className="mb-2 text-xl font-bold">22. Governing Law</h2>
        <p className="mb-4">
          This Agreement shall be governed by, and construed and enforced in accordance with, the laws of Texas. Without regard to conflict of law rules or
          principles that would cause the application of the laws of any other jurisdiction. You agree that Akash may initiate a proceeding relating to the
          enforceability or validity of Akash&apos;s intellectual property rights in any court of competent jurisdiction. With respect to any other proceeding
          not subject to arbitration under this Agreement, the federal and state courts located in Texas will have exclusive jurisdiction. You waive any
          objection to venue in any such courts.
        </p>

        <h2 className="mb-2 text-xl font-bold">23. Amendments to this Agreement</h2>
        <p className="mb-4">
          Akash reserves the right to amend this Agreement and/or policies that govern the Services from time to time and in our sole discretion. Any changes
          will be effective immediately upon posting of the revisions, and you waive any right you may have to receive specific notices of such changes or
          modifications. By continuing to use the Services after any changes are posted to the website, you agree to be bound by those changes. If you do not
          agree to the changes, you may stop using the Services.
        </p>

        <h2 className="mb-2 text-xl font-bold">24. Miscellaneous Terms</h2>
        <h3 className="mb-2 text-lg font-bold">24.1 Assignment</h3>
        <p className="mb-4">
          These Terms, and any other document, material, or information referenced herein is particular to you and any attempt that you make to assign, novate,
          or transfer your rights, interests, liabilities, and/or obligations is null and void, unless you have received Akash&apos;s prior written consent.
          Akash reserves the right to assign our rights without restriction, including without limitation to any of Akash&apos;s affiliates or subsidiaries, or
          to any successor in interest of any business associated with the Services. Subject to the foregoing, these Terms will bind and inure to the benefit of
          the parties and their successors and permitted assigns.
        </p>

        <h3 className="mb-2 text-lg font-bold">24.2 Termination & Survival</h3>
        <p className="mb-4">
          We reserve the right to change, suspend or discontinue, or terminate, restrict, or disable your use of or access to, parts or all of the Services or
          their functionality at any time at our sole discretion and without notice. All sections of this Agreement that by their nature should survive
          termination shall survive termination.
        </p>

        <h3 className="mb-2 text-lg font-bold">24.3 Nonwaiver of Rights</h3>
        <p className="mb-4">
          Akash&apos;s failure or delay in exercising any right, power, or privilege under these Terms shall not operate as a waiver thereof.
        </p>

        <h3 className="mb-2 text-lg font-bold">24.4 Severability</h3>
        <p className="mb-4">
          If any provision of this Agreement shall be determined to be invalid or unenforceable under any rule, law, or regulation, or any governmental agency
          whether local, state, or federal, such provision shall be interpreted to accomplish the objectives of the provision to the greatest extent possible
          under any applicable law, and the validity or enforceability of any other provision of the Terms shall not be affected.
        </p>

        <h3 className="mb-2 text-lg font-bold">24.5 Force Majeure</h3>
        <p className="mb-4">
          You acknowledge and consent that the Services are provided by us according to our current technological capability and other business conditions.
          While we have made every effort to ensure continuity and security of the Services, we are unable to completely foresee and hedge against all legal,
          technological, and other risks.
        </p>
        <p className="mb-4">
          Akash shall not be held liable for delays, failure in performance, or interruption of Services that result directly or indirectly from any cause or
          condition beyond our reasonable control. Such instances include: (a) acts of God such as earth earthquakes, fires, cyclones, explosions, typhoons,
          monsoons, landslides, lightning, storms, tempests, pandemics, droughts or meteors; (b) acts of war, whether declared or undeclared, including
          invasion, act of a foreign enemy, hostilities between nations, civil insurrection, or militarily usurped power; and acts of terrorism; (c) civil
          disorder, such as acts of a public enemy, malicious damage, terrorism, sabotage, or civil unrest; (d) embargoes or sanctions (such as confiscation,
          nationalization, requisition, expropriation, prohibition, restraint or damage to property by or under the order of any government or governmental
          authority; (e) unnatural disasters, such as ionizing radiation or contamination by radioactivity from any nuclear waste or from combustion of nuclear
          fuel; (f) labor disputes, including strikes, blockades, lock-outs, or other industrial disputes; (g) failure of telecommunication outlets, including
          the internet, communications networks and facilities, or other infrastructure, systems, operations or of equipment relevant to the provision or use of
          the Services; (h) data breaches or data-processing failure or incomplete processing; and/or (i) changes in laws or regulations that may materially
          affect the Digital Assets and/or blockchain industries (collectively, &quot;Force Majeure Events&quot;).
        </p>

        <h3 className="mb-2 text-lg font-bold">24.6 Notice</h3>
        <p className="mb-4">
          Any notices or other communications provided by us under these Terms including those regarding modifications to these Terms will be posted online, in
          the Services, or through other electronic communication. You agree and consent to receive electronically all communications, agreements, documents,
          notices, and disclosures that we provide in connection with your use of the Services.
        </p>

        <h3 className="mb-2 text-lg font-bold">24.7 Privacy</h3>
        <p className="mb-4">
          To understand how Akash collects, uses, and shares information about you, please review our{" "}
          <Link href={UrlService.privacyPolicy()}>Privacy Policy</Link>.
        </p>

        <h3 className="mb-2 text-lg font-bold">24.8 Third Party Beneficiaries</h3>
        <p className="mb-4">
          Nothing in this Agreement, expressed or implied, is intended to confer upon any person, other than the parties and their successors and permitted
          assigns, any of the rights hereunder.
        </p>

        <h3 className="mb-2 text-lg font-bold">24.9 Entire Agreement</h3>
        <p className="mb-4">
          These Terms and every other term or provision applicable to you, including any document incorporated by reference herein, constitute the entire
          agreement and understanding between you and Akash as to the subject matter hereof, and supersede any and all prior discussions, agreements, and
          understandings of any kind (including any prior versions of these Terms). Unless otherwise specifically stated, these Terms govern and control any
          conflict between these Terms and any other agreement you may have with Akash.
        </p>

        <h3 className="mb-2 text-lg font-bold">24.10 Translation</h3>
        <p className="mb-4">
          These Terms are set forth in the English language and all communications including any notices or information being transmitted shall be in English.
          In the event that these Terms or any part of it is translated (for any proceedings, for your convenience, or otherwise) into any other language, the
          English language text of these Terms shall prevail.
        </p>
      </div>
    </Layout>
  );
}

export default TermsOfService;
