# 글로벌 수익화 준비 가이드북

작성일: 2026-06-12  
대상 서비스: Qkiki Multi AI Workbench  
주요 타겟: 미국 등 영어권 글로벌 사용자, 한국 사용자 포함  

> 이 문서는 사업/결제/세무 운영 설계를 위한 실행 가이드입니다. 세무 신고, 법률 문구, 해외 정산 처리는 실제 사업자 형태와 매출 국가에 따라 달라지므로 최종 적용 전 세무사/변호사/결제사 온보딩 담당자에게 확인해야 합니다.

## 1. 결론

### 1.1 추천 운영 방향

초기 글로벌 런칭은 **USD 기준 구독제 + 크레딧 기반 사용량 관리 + Merchant of Record(MoR) 결제사** 조합이 가장 안전합니다.

추천 순서:

1. **1단계: Paddle 또는 Lemon Squeezy로 글로벌 결제 시작**
   - 미국/유럽/영국/캐나다/호주 등 영어권 고객에게 카드/PayPal 결제를 제공.
   - 고객에게 부과되는 VAT, sales tax, GST 등 해외 간접세 부담을 MoR이 상당 부분 처리.
   - 한국 사업자는 MoR에서 정산받은 금액을 한국 사업자 통장 또는 외화통장으로 수령.

2. **2단계: 한국 고객 매출 비중이 커지면 KRW 로컬 결제 추가**
   - PortOne, Toss Payments, KG이니시스, KCP 등 국내 PG를 붙여 원화 결제와 국내 간편결제를 제공.
   - 단, 국내 PG를 붙이면 국내 부가세, 현금영수증/세금계산서, 전자상거래 표시의무, 환불 정책 운영 부담이 커짐.

3. **3단계: 매출이 커지면 법인 전환 또는 해외 법인/Stripe 검토**
   - 한국 개인사업자 단계에서는 MoR이 가장 빠름.
   - 미국 법인 설립 후 Stripe를 쓰는 방식은 강력하지만, 법인 유지비, 미국 세무, 회계, 은행, 법무 부담이 생김.

### 1.2 USD 결제와 KRW 결제 판단

글로벌 타겟이면 **가격 체계의 기준 통화는 USD로 두는 것**이 맞습니다. AI API 원가도 대부분 USD로 계산되고, 미국 사용자에게 가격 저항이 낮으며, 매출 분석과 마진 관리가 단순해집니다.

한국 사용자도 초기에 USD로 결제하게 해도 운영은 단순합니다. 다만 한국 사용자는 해외 결제 수수료, 카드 승인 실패, 원화 환산 불확실성 때문에 전환율이 떨어질 수 있습니다.

따라서 현실적인 판단은 다음과 같습니다.

| 단계 | 권장 결제 통화 | 이유 |
|---|---:|---|
| 초기 글로벌 검증 | USD 단일 가격 | 개발/회계/가격 실험이 단순함 |
| 한국 사용자 비중 20~30% 미만 | USD 유지, 화면에 KRW 참고가 표시 가능 | 국내 PG 운영 비용을 미룸 |
| 한국 사용자 비중 20~30% 이상 | KRW 로컬 결제 추가 | 전환율 개선 효과가 운영 복잡도보다 커짐 |
| B2B/팀 고객 증가 | USD invoice 또는 MoR invoice | 해외 기업 구매 프로세스 대응 |

핵심 원칙: **서비스 내부 크레딧은 통화와 분리**해야 합니다. 사용량은 크레딧으로 기록하고, 결제 통화는 USD/KRW/EUR 등으로 확장 가능하게 둡니다.

### 1.3 이미지 생성 과금 운영 원칙

이미지 생성은 글로벌 수익화에서 별도 원가 항목으로 분리해야 합니다. 텍스트 답변은 주로 입력/출력 토큰 수에 비례하지만, 이미지 생성은 공급자별로 이미지 출력 토큰 또는 이미지 1장 단위 과금이 붙습니다. 따라서 동일한 월 크레딧 안에서 텍스트와 이미지를 같은 요청 1회로 취급하면 운영자가 손실을 봅니다.

2026-06-15 현재 적용 기준은 다음입니다.

| 모델군 | 기준 원가 | 차감 기준 |
|---|---:|---:|
| OpenAI `gpt-image-2` | $0.053 / image | 19 credits |
| OpenAI `gpt-image-1` | $0.042 / image | 15 credits |
| Google Imagen 4 Standard | $0.040 / image | 14 credits |
| Google Imagen 4 Fast | $0.020 / image | 7 credits |
| Google Imagen 4 Ultra | $0.060 / image | 21 credits |
| Google Gemini 3 Pro Image | $0.134 / image | 46 credits |
| xAI Grok Imagine Image | $0.020 / image | 7 credits |

운영 권장:

- 가격 페이지에는 "이미지 생성은 이미지 수와 모델에 따라 크레딧이 다르게 차감됩니다"를 명시합니다.
- 무료 플랜에서는 이미지 생성을 비활성화하거나 하루 1장 이하로 제한합니다.
- Starter에서는 저가/표준 이미지 모델만 열고, Pro 이상에서 고품질 이미지 모델을 엽니다.
- 2K/4K, high quality, 이미지 편집, 다중 이미지 생성은 반드시 실행 전 예상 크레딧을 보여줍니다.
- 한국/글로벌 결제 통화와 무관하게 내부 차감 단위는 항상 credits로 고정합니다.

## 2. 구독 시스템 설계

### 2.1 가격 체계 추천

현재 서비스는 AI API 호출 원가가 모델, 반복 횟수, 병렬 모델 수, 순차 체인 길이에 따라 크게 달라집니다. 따라서 "무제한" 문구는 피하고, **월 구독 크레딧 + 초과 크레딧 충전** 구조가 안전합니다.

추천 글로벌 가격:

| 플랜 | 월 가격 | 월 크레딧 | 일 크레딧 제한 | 주요 대상 |
|---|---:|---:|---:|---|
| Free | $0 | 50 | 25 | 제품 체험, SEO 유입 |
| Starter | $11.30/mo | 700 | 120 | 가격 민감 개인 사용자, 라이트 비교 |
| Pro | $29/mo | 2,400 | 400 | 반복 검토, 개인 주력 사용자 |
| Team | $89/mo | 7,500 | 1,300 | 소규모 팀, 장문 검토 |
| Credit Pack | $39 | 2,500 | 플랜 일한도 적용 | 피크 사용, 프로젝트성 사용 |

연간 결제:

| 플랜 | 연간 가격 | 할인율 | 판단 |
|---|---:|---:|---|
| Starter Annual | $113/year | 약 2개월 할인 | 초기 전환용 |
| Pro Annual | $290/year | 약 2개월 할인 | 주력 |
| Team Annual | $890/year | 약 2개월 할인 | B2B 협상 가능 |

### 2.2 왜 이 가격대가 맞는가

AI 원가는 예측이 흔들립니다. 특히 GPT/Claude/Gemini/Grok의 고성능 모델, 긴 입력, 순차 반복이 겹치면 사용량이 급증합니다. 따라서 가격은 단순 API 원가의 2배가 아니라 다음 비용까지 포함해야 합니다.

- API 원가
- 결제 수수료
- 환율 손실
- 환불/차지백 손실
- 무료 사용자 비용
- 서버/DB/워크플로 비용
- 고객지원 비용
- 세무/회계 비용

현재 코드의 크레딧 환산은 `API 예상 원가 x 환율 x 리스크 배수` 기준으로 잡는 구조입니다. 운영상 최소 마진은 **API 원가의 2.2배 이상**을 기준선으로 두고, 구독 판매가는 그보다 더 넉넉하게 잡는 것이 안전합니다.

### 2.3 가격 표시 방식

글로벌 페이지:

- 기본 표시: `$11.30/mo`, `$29/mo`, `$89/mo`
- 보조 표시: "Includes 700 credits/month"
- 한국어 UI: "월 $11.30", "월 700 크레딧 포함"

한국 사용자에게 원화 참고가 필요하면 "약 40,000원"처럼 환율 참고값을 보여줄 수 있습니다. 단, 실제 청구 통화가 USD라면 반드시 "실제 결제는 USD로 청구됩니다"를 표시해야 합니다.

## 3. 결제 플러그인/결제사 선택

### 3.1 결제사 비교

| 결제사 | 유형 | 장점 | 단점 | 추천도 |
|---|---|---|---|---|
| Paddle | MoR | SaaS 구독, 글로벌 세금, PayPal/카드, 정산 지원 | 수수료가 높고 심사 필요 | 1순위 |
| Lemon Squeezy | MoR | 구현이 비교적 쉬움, 디지털 상품/구독 친화적, 세금 처리 | 한국 사업자 온보딩/정산 조건 확인 필요 | 1~2순위 |
| FastSpring | MoR | 글로벌 소프트웨어 판매 경험, B2B 대응 강함 | 비용/온보딩이 무거울 수 있음 | B2B 커질 때 |
| Stripe Billing | PSP | 개발자 경험 최고, 구독/웹훅/Tax 강함 | 한국 소재 사업자 직접 시작은 제약 확인 필요 | 해외 법인 있을 때 |
| PayPal 직접 연동 | PSP/Wallet | 글로벌 인지도, 한국 계정 인출 가능 | 구독/세금/차지백/회계 자동화 약함 | 보조 결제 |
| PortOne/Toss Payments | 국내 PG | KRW, 국내 카드/간편결제 전환율 좋음 | 글로벌 세금 해결 안 됨, 국내 정산/세무 운영 필요 | 한국 매출 커질 때 |

### 3.2 Paddle을 쓰는 경우

적합한 경우:

- 글로벌 SaaS 구독을 빠르게 시작해야 함.
- 미국/유럽 매출을 받을 예정.
- VAT, sales tax, GST를 직접 신고하고 싶지 않음.
- 결제 실패 복구, 구독 변경, 환불, 인보이스가 필요함.

운영 구조:

1. Paddle 계정 생성 및 사업자/KYC 제출.
2. Product/Price 생성: Starter, Pro, Team, Credit Pack.
3. Checkout 링크 또는 overlay checkout 연동.
4. Webhook 수신: subscription created/updated/canceled, transaction completed/refunded.
5. 앱 DB에 `planType`, `monthlyCreditLimit`, `CreditWallet` 반영.
6. Paddle payout을 한국 사업자 외화통장 또는 Payoneer/Wise 계좌로 수령.

공식 근거:

- Paddle은 글로벌 SaaS 판매에서 MoR 모델로 결제/세금/컴플라이언스를 처리한다고 설명합니다: [Paddle](https://www.paddle.com/)
- Paddle 정산은 wire transfer 또는 Payoneer를 지원하고, 일부 국가에서 SWIFT 수수료가 발생할 수 있습니다: [Paddle payout help](https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid)

### 3.3 Lemon Squeezy를 쓰는 경우

적합한 경우:

- 구현 속도와 단순한 구독 판매가 중요함.
- 디지털 상품/SaaS checkout을 빠르게 붙이고 싶음.
- MoR 방식으로 글로벌 세금 처리를 줄이고 싶음.

운영 구조:

1. Lemon Squeezy store 생성.
2. Products/Variants로 월간/연간/크레딧팩 생성.
3. Checkout URL 또는 overlay 연동.
4. Webhook으로 subscription/order/refund 이벤트 수신.
5. 앱 내부 권한과 크레딧 지급.
6. 정산 주기에 맞춰 한국 계좌로 payout.

공식 근거:

- Lemon Squeezy는 MoR로 디지털 판매세와 컴플라이언스를 처리한다고 설명합니다: [Lemon Squeezy MoR](https://www.lemonsqueezy.com/reporting/merchant-of-record)
- 정산은 월 2회 생성되고, 매출은 13일 보류 후 지급 가능하며 계좌 반영까지 1~5일이 걸릴 수 있습니다: [Lemon Squeezy getting paid](https://docs.lemonsqueezy.com/help/getting-started/getting-paid)

### 3.4 Stripe를 바로 쓰는 경우의 판단

Stripe는 기술적으로 가장 좋은 결제 개발 경험을 제공합니다. 하지만 한국 소재 사업자로 바로 Stripe Billing을 운영할 수 있는지, 한국 사업자 계정 지원 여부, 세금/정산 가능 여부는 반드시 현재 Stripe 공식 지원 국가와 온보딩 화면에서 확인해야 합니다.

중요한 구분:

- Stripe 문서에는 한국 고객에게 로컬 카드/지갑 결제를 제공하는 기능이 있습니다.
- 그러나 그것이 "한국 소재 사업자가 Stripe 계정을 바로 만들 수 있다"는 의미는 아닙니다.
- Stripe 공식 글로벌 페이지는 지원 국가 밖 사업자에게 Payments가 아직 지원되지 않을 수 있음을 안내합니다.

공식 근거:

- Stripe 글로벌 지원 페이지: [Stripe global](https://stripe.com/global)
- Stripe 한국 결제수단 문서: [South Korean payment methods](https://docs.stripe.com/payments/countries/korea)

추천:

- 한국 개인사업자/법인으로 바로 시작: Paddle 또는 Lemon Squeezy 우선.
- 미국 Delaware C-Corp/LLC와 미국 은행 계좌를 만들 계획이 있음: Stripe Billing + Stripe Tax 검토.

### 3.5 한국 국내 PG를 붙이는 경우

적합한 경우:

- 한국 사용자 비중이 커짐.
- 카카오페이, 네이버페이, 토스페이, 국내 카드 승인률이 중요함.
- 원화 결제와 국내 환불/영수증 운영을 감당할 수 있음.

후보:

- PortOne: 여러 국내 PG를 하나의 API로 연결하는 결제 오케스트레이션.
- Toss Payments: 국내 카드/간편결제 UX가 좋음.
- KG이니시스/KCP/NICE: 전통적인 국내 PG.
- Eximbay: 한국 기반 크로스보더 결제에 강점.

공식 근거:

- PortOne Korea 문서는 KG이니시스, Toss, KCP, NICE, Eximbay 등 KRW 결제수단을 지원한다고 안내합니다: [PortOne Korea](https://docs.portone.cloud/docs/portone-korea)

초기에는 국내 PG를 붙이지 않는 것을 추천합니다. 한국 결제 전환율보다 글로벌 런칭 속도와 세무 단순성이 더 중요하기 때문입니다.

## 4. 사업자등록과 정산 구조

### 4.1 한국에서 시작하는 기본 구조

초기 권장 구조:

| 항목 | 추천 |
|---|---|
| 사업자 형태 | 개인사업자 또는 1인 법인 |
| 업태 | 정보통신업, 서비스업 등 세무사 확인 |
| 종목 | 소프트웨어 개발 및 공급업, 응용 소프트웨어 개발 및 공급업, 전자상거래 관련 업종 등 확인 |
| 통장 | 사업자 명의 원화 통장 + 외화 통장 |
| 결제사 | Paddle 또는 Lemon Squeezy |
| 정산 | MoR payout -> 외화통장 또는 원화통장 |
| 회계 | 월별 payout statement, 수수료, 환불, 환율 기록 |

국세청은 사업 개시 전 또는 사업 시작일부터 20일 이내 사업자등록을 신청해야 하며, 홈택스로 전자 제출과 사업자등록증 발급이 가능하다고 안내합니다: [국세청 사업자등록 신청](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7777&mi=2444)

### 4.2 사업자등록 절차

1. 홈택스에서 사업자등록 신청.
2. 상호, 사업장 주소, 업태/종목 입력.
3. 임대차계약서 또는 사업장 관련 서류 준비.
4. 사업자등록증 발급.
5. 사업자 명의 은행 계좌 개설.
6. 필요 시 외화통장 개설.
7. 통신판매업 신고 검토.
8. 결제사 KYC/KYB 제출.
9. 개인정보처리방침, 이용약관, 환불정책, 가격정책 게시.

### 4.3 통신판매업 신고

자체 웹사이트에서 유료 구독을 판매하면 통신판매업 신고 대상이 될 가능성이 높습니다. 정부24의 통신판매업 신고 민원은 인터넷 또는 방문 신청이 가능하다고 안내됩니다: [정부24 통신판매업신고](https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=11300000006)

단, MoR을 쓰는 경우 고객과의 법적 판매자가 Paddle/Lemon Squeezy가 되는 구조라 국내 통신판매업 신고/표시의무 범위가 달라질 수 있습니다. 하지만 국내 사용자에게 한국어 웹사이트로 판매하고, 운영자가 한국 사업자인 경우에는 신고와 표시정보를 준비하는 편이 안전합니다.

준비할 표시정보:

- 상호
- 대표자명
- 사업자등록번호
- 통신판매업 신고번호
- 사업장 주소
- 이메일
- 환불/해지 정책
- 개인정보처리방침
- 서비스 이용약관

### 4.4 한국 통장으로 글로벌 수익 받는 방법

방법 A: MoR -> 한국 외화통장

1. 한국 사업자 명의 외화통장 개설.
2. 은행에서 SWIFT/BIC, 영문 은행명, 영문 주소, 계좌번호 확인.
3. Paddle/Lemon Squeezy payout 설정에 입력.
4. USD로 수령.
5. 필요 시 원화 환전.
6. 정산명세서, 환율, 수수료를 회계 자료로 보관.

방법 B: MoR -> Payoneer/Wise -> 한국 통장

1. Payoneer 또는 Wise Business 계정 개설.
2. MoR payout을 해당 계좌로 수령.
3. 필요한 시점에 한국 계좌로 송금.
4. 중간 계좌 수수료와 환율을 매월 기록.

방법 C: PayPal Business -> 한국 통장

1. PayPal Business 계정 생성.
2. 해외 결제 수령.
3. 한국 통장으로 인출.
4. PayPal 수수료와 환전 수수료 반영.

PayPal Korea 공식 수수료 페이지는 비즈니스 계정 잔액을 현지 은행 계좌로 인출할 수 있고, 통화 변환 시 추가 수수료가 적용될 수 있다고 설명합니다: [PayPal KR business fees](https://www.paypal.com/kr/business/paypal-business-fees?locale.x=en_KR)

## 5. 세금과 회계

### 5.1 MoR 사용 시 세금 책임 구분

MoR을 쓰면 고객에게 판매하는 법적 판매자가 MoR입니다. 따라서 해외 고객에게 부과되는 sales tax, VAT, GST의 계산/징수/납부를 MoR이 처리하는 구조가 됩니다.

하지만 한국 사업자는 다음 책임이 남습니다.

- 한국에서 발생한 사업소득 또는 법인소득 신고.
- MoR 정산액 매출 인식.
- 결제 수수료, 환불, 차지백 비용 처리.
- 외화 수입과 환율 기록.
- 부가세 신고 시 과세/영세율/면세 여부 검토.

### 5.2 해외 매출 부가세 판단

부가가치세법에는 국외에서 공급하는 용역과 외화획득 용역에 대한 영세율 규정이 있습니다: [부가가치세법 제21~24조](https://law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsId=001571&lsJoLnkSeq=900316816&print=print)

하지만 SaaS/전자적 용역은 고객 위치, 공급 장소, 계약 상대방, MoR 구조, 대금 수령 방식에 따라 판단이 달라질 수 있습니다. 따라서 운영 정책은 이렇게 잡는 것이 안전합니다.

- 해외 고객 매출: 영세율 가능성 검토.
- 한국 고객 매출: 일반적으로 국내 부가세 10% 고려.
- MoR 정산 매출: 판매대행/재판매 구조를 세무사와 확인.
- 증빙: payout statement, 거래내역, 환불내역, 수수료내역, 국가별 매출 리포트 보관.

### 5.3 매월 회계 루틴

매월 1회 정리할 자료:

- 결제사 월별 gross sales.
- 결제사 수수료.
- 환불/차지백.
- MoR이 징수한 세금.
- 실제 payout 금액.
- payout 통화와 입금일.
- 입금일 환율 또는 회계 기준 환율.
- OpenAI/Anthropic/Google/xAI API 원가.
- Vercel/DB/이메일/스토리지 비용.
- 순매출, 매출총이익, API 원가율.

권장 KPI:

| 지표 | 목표 |
|---|---:|
| API 원가율 | 매출의 25~40% 이하 |
| 결제/환전/세금 플랫폼 비용 | 매출의 5~12% 범위 |
| 무료 사용자 비용 | 전체 API 비용의 20% 이하 |
| Pro 플랜 비중 | MRR의 40% 이상 |
| 환불률 | 5% 이하 |
| 차지백률 | 0.5% 이하 |

## 6. 결제 시스템 구현 가이드

### 6.1 내부 DB 설계 원칙

서비스 내부에서는 다음 개념을 분리해야 합니다.

| 개념 | 의미 |
|---|---|
| Plan | Starter/Pro/Team 같은 구독 등급 |
| Credit Entitlement | 월마다 제공되는 크레딧 한도 |
| Credit Wallet | 충전형/보너스/쿠폰 크레딧 잔액 |
| Usage Log | 실제 AI 실행별 크레딧 소모 기록 |
| Payment Event | 결제사 webhook 원본 이벤트 |
| Subscription State | 활성/취소/연체/만료 상태 |

중요한 원칙:

- 결제 통화와 사용량 크레딧은 분리.
- 결제사 webhook은 멱등 처리.
- 환불 발생 시 지급한 크레딧을 회수하거나 다음 결제에서 차감.
- 구독 취소는 즉시 차단보다 "결제 기간 종료 시 비활성"이 일반적.
- 결제 실패는 grace period를 둠.

### 6.2 Webhook 필수 이벤트

구독형:

- subscription created
- subscription updated
- subscription canceled
- subscription paused/resumed
- payment succeeded
- payment failed
- refund created
- chargeback/dispute opened

크레딧팩:

- order paid
- order refunded
- chargeback opened

앱 처리:

- payment succeeded -> 플랜 활성화 또는 크레딧 지급.
- payment failed -> 유예 상태, 알림, 재시도.
- cancel -> 기간 종료일 기록.
- refund -> 크레딧 회수 또는 계정 제한.
- chargeback -> 즉시 조사 및 사용 제한.

### 6.3 환불 정책

초기 추천:

- 월 구독: 결제 후 7일 이내, 사용 크레딧이 10% 미만이면 환불 가능.
- 연 구독: 14일 이내, 사용량이 낮으면 환불 가능.
- 크레딧팩: 미사용분만 환불 가능.
- 악용/대량 API 사용 후 환불은 거부 가능.

약관에는 다음을 명시해야 합니다.

- AI API 원가가 발생하는 서비스라는 점.
- 실행 완료된 AI 작업은 디지털 서비스 소비로 간주된다는 점.
- 환불 시 지급 크레딧이 회수될 수 있다는 점.
- 크레딧은 현금성 자산이 아니라 서비스 사용권이라는 점.

## 7. 약관/개인정보/컴플라이언스 준비

### 7.1 필수 문서

영어:

- Terms of Service
- Privacy Policy
- Refund Policy
- Acceptable Use Policy
- AI Output Disclaimer
- Cookie Policy, 필요 시

한국어:

- 서비스 이용약관
- 개인정보처리방침
- 환불정책
- 유료서비스 이용약관
- 사업자 표시정보

### 7.2 개인정보와 AI 입력 데이터

글로벌 사용자는 AI 입력에 민감한 정보를 넣을 수 있습니다. 다음 정책이 필요합니다.

- 사용자가 입력한 텍스트/첨부파일을 어떤 AI provider로 전송하는지 명시.
- OpenAI, Anthropic, Google, xAI 등 제3자 처리자 명시.
- 사용자가 데이터를 삭제할 수 있는 경로 제공.
- 결제 데이터는 직접 저장하지 않고 결제사에 위임.
- API key와 결제 webhook secret은 서버 환경변수로만 관리.

### 7.3 미국/유럽 대응

미국:

- 주별 sales tax는 MoR을 쓰면 상당 부분 MoR이 처리.
- 직접 Stripe를 쓰면 Stripe Tax 같은 도구와 주별 등록/신고 판단이 필요.

유럽/영국:

- VAT가 핵심.
- MoR을 쓰면 VAT 계산/징수/납부 부담을 줄일 수 있음.
- 직접 판매하면 EU VAT OSS/IOSS 등 검토 필요.

한국:

- 국내 사용자 유료 판매 시 부가세, 통신판매업, 개인정보처리방침, 표시의무 준비.
- MoR 구조라도 한국어 페이지와 한국 사용자 판매가 있으면 세무/법무 검토 권장.

## 8. 출시 전 체크리스트

### 8.1 사업/계정

- 사업자등록 완료.
- 사업자 통장 개설.
- 외화통장 또는 Payoneer/Wise 준비.
- 통신판매업 신고 여부 확인.
- 결제사 MoR 계정 신청.
- KYC/KYB 서류 준비: 사업자등록증, 신분증, 주소, 은행 계좌, 웹사이트 URL, 서비스 설명.

### 8.2 제품

- 가격 페이지 USD 기준으로 변경.
- 한국어 UI에는 USD 결제 안내 추가.
- 플랜별 월 크레딧/일 크레딧/초과 크레딧 표시.
- 결제 성공 후 플랜 반영.
- 결제 실패/구독 취소/환불 상태 표시.
- 사용량 카드에 월 크레딧, 일 크레딧, 쿠폰, 지갑, 남은 횟수 표시.

### 8.3 결제

- Checkout 테스트 모드.
- Webhook signature 검증.
- Webhook idempotency 저장.
- 구독 업그레이드/다운그레이드 처리.
- 환불 webhook 처리.
- 크레딧팩 지급/회수 처리.
- 영수증/인보이스 링크 제공.

### 8.4 운영

- 월별 매출 리포트 템플릿.
- API 원가 리포트.
- 국가별 매출 리포트.
- 환불/차지백 대응 템플릿.
- 고객지원 이메일.
- 장애 공지 채널.

### 8.5 법무/정책

- Terms of Service 게시.
- Privacy Policy 게시.
- Refund Policy 게시.
- 유료서비스 정책 게시.
- AI 결과물 책임 제한 문구 게시.
- 사업자 표시정보 게시.

## 9. 추천 실행 로드맵

### 9.1 0~2주차

목표: 글로벌 결제 가능한 최소 구조 완성.

- Paddle과 Lemon Squeezy 둘 다 계정 신청.
- 승인 빠른 쪽으로 우선 구현.
- USD 플랜 생성: Starter $11.30, Pro $29, Team $89, Credit Pack $39.
- webhook endpoint 구현.
- 결제 성공 시 앱 플랜/크레딧 반영.
- 환불/취소 처리.
- 영어 가격 페이지와 약관 초안 게시.

### 9.2 3~6주차

목표: 결제 전환율과 원가율 안정화.

- 무료 사용량 축소/확대 A/B 테스트.
- Starter와 Pro의 전환율 비교.
- 고원가 모델 사용자의 API 원가율 추적.
- 초과 크레딧팩 구매율 확인.
- 결제 실패 복구 이메일 추가.
- 환불 사유 수집.

### 9.3 2~3개월차

목표: 한국 로컬 결제 여부 판단.

- 한국 사용자 비중 확인.
- 한국 결제 실패율 확인.
- 한국 사용자 문의에서 "원화 결제" 요구 빈도 확인.
- 한국 MRR이 전체의 20~30% 이상이면 PortOne/Toss Payments 검토.
- B2B 문의가 있으면 인보이스 결제/연간 플랜 견적서 준비.

## 10. 최종 추천

Qkiki의 첫 글로벌 수익화 구조는 다음이 가장 현실적입니다.

1. **기준 가격은 USD**
2. **결제사는 Paddle 또는 Lemon Squeezy**
3. **한국 사용자는 초기에는 USD 결제 허용**
4. **한국 매출이 커지면 KRW 로컬 결제 추가**
5. **내부 사용량은 무조건 크레딧 단위로 유지**
6. **구독 플랜은 $29 / $99 / $299**
7. **초과 사용은 $39 / 2,500 크레딧팩**
8. **사업자등록, 통신판매업 신고, 외화통장, 약관/개인정보/환불정책 준비**
9. **세무는 MoR 해외 매출과 국내 매출을 분리해서 세무사와 확인**

운영 관점에서 가장 중요한 것은 "결제 통화"가 아니라 **API 원가율을 통제하는 크레딧 정책**입니다. 결제는 USD로 시작하되, 크레딧 소모와 한도를 정확히 보여주면 글로벌 사용자와 한국 사용자 모두에게 가격 설명이 쉬워지고, 운영자는 원가 폭주를 방지할 수 있습니다.

## 참고 공식 자료

- [Stripe global availability](https://stripe.com/global)
- [Stripe South Korean payment methods](https://docs.stripe.com/payments/countries/korea)
- [Stripe Tax supported countries](https://docs.stripe.com/tax/supported-countries)
- [Paddle Merchant of Record](https://www.paddle.com/)
- [Paddle payout guide](https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid)
- [Lemon Squeezy Merchant of Record](https://www.lemonsqueezy.com/reporting/merchant-of-record)
- [Lemon Squeezy getting paid](https://docs.lemonsqueezy.com/help/getting-started/getting-paid)
- [PayPal Korea business fees](https://www.paypal.com/kr/business/paypal-business-fees?locale.x=en_KR)
- [PortOne Korea payment methods](https://docs.portone.cloud/docs/portone-korea)
- [국세청 사업자등록 신청 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7777&mi=2444)
- [정부24 통신판매업신고](https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=11300000006)
- [부가가치세법 영세율 규정](https://law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsId=001571&lsJoLnkSeq=900316816&print=print)
