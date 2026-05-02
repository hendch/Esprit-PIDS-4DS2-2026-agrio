export type DiseaseInfo = {
  en: { displayName: string; advice: string };
  ar: { displayName: string; advice: string };
};

export const DISEASE_DATA: Record<string, DiseaseInfo> = {
  "Apple__Apple_scab": {
    en: {
      displayName: "Apple - Apple Scab",
      advice:
        "Remove and destroy infected leaves and fruit. Apply fungicide (captan or myclobutanil) in early spring. Prune trees to improve air circulation. Choose resistant apple varieties for future planting.",
    },
    ar: {
      displayName: "تفاح - جرب التفاح",
      advice:
        "أزل الأوراق والثمار المصابة وأتلفها. استخدم مبيد فطري (كابتان أو مايكلوبيوتانيل) في أوائل الربيع. قلّم الأشجار لتحسين دوران الهواء. اختر أصناف تفاح مقاومة للزراعة المستقبلية.",
    },
  },
  "Apple__Black_rot": {
    en: {
      displayName: "Apple - Black Rot",
      advice:
        "Remove mummified fruits and dead wood from the tree. Apply fungicide during the growing season. Maintain good sanitation around the orchard. Ensure proper pruning to reduce humidity.",
    },
    ar: {
      displayName: "تفاح - العفن الأسود",
      advice:
        "أزل الثمار المتحللة والأخشاب الميتة من الشجرة. استخدم مبيد فطري خلال موسم النمو. حافظ على نظافة البستان. تأكد من التقليم الجيد لتقليل الرطوبة.",
    },
  },
  "Apple__Cedar_apple_rust": {
    en: {
      displayName: "Apple - Cedar Apple Rust",
      advice:
        "Remove nearby cedar or juniper trees if possible. Apply fungicide (myclobutanil) at bloom stage. Plant resistant apple varieties. Monitor trees in spring for early signs of infection.",
    },
    ar: {
      displayName: "تفاح - صدأ أرز التفاح",
      advice:
        "أزل أشجار الأرز أو العرعر القريبة إن أمكن. استخدم مبيد فطري (مايكلوبيوتانيل) في مرحلة الإزهار. ازرع أصناف تفاح مقاومة. راقب الأشجار في الربيع للكشف المبكر عن الإصابة.",
    },
  },
  "Apple__healthy": {
    en: {
      displayName: "Apple - Healthy",
      advice:
        "Your apple plant looks healthy! Continue regular watering, fertilizing, and pruning. Monitor regularly for early signs of disease or pests.",
    },
    ar: {
      displayName: "تفاح - سليم",
      advice:
        "نبتة التفاح تبدو بصحة جيدة! استمر في الري والتسميد والتقليم المنتظم. راقب النبات بانتظام للكشف المبكر عن أي أمراض أو آفات.",
    },
  },
  "Blueberry__healthy": {
    en: {
      displayName: "Blueberry - Healthy",
      advice:
        "Your blueberry plant is healthy! Maintain acidic soil (pH 4.5-5.5), regular watering, and mulching. Prune annually to encourage new growth.",
    },
    ar: {
      displayName: "توت أزرق - سليم",
      advice:
        "نبتة التوت الأزرق سليمة! حافظ على تربة حمضية (pH 4.5-5.5) والري المنتظم والتغطية. قلّم سنوياً لتشجيع النمو الجديد.",
    },
  },
  "Cherry_(including_sour)__Powdery_Mildew": {
    en: {
      displayName: "Cherry - Powdery Mildew",
      advice:
        "Apply sulfur-based or potassium bicarbonate fungicide. Improve air circulation through pruning. Avoid overhead watering. Remove and destroy infected plant parts.",
    },
    ar: {
      displayName: "كرز - البياض الدقيقي",
      advice:
        "استخدم مبيد فطري قائم على الكبريت أو بيكربونات البوتاسيوم. حسّن دوران الهواء عبر التقليم. تجنب الري العلوي. أزل وأتلف الأجزاء المصابة.",
    },
  },
  "Cherry_(including_sour)__healthy": {
    en: {
      displayName: "Cherry - Healthy",
      advice:
        "Your cherry tree is healthy! Keep up good watering practices, annual pruning, and pest monitoring. Protect fruit from birds as they ripen.",
    },
    ar: {
      displayName: "كرز - سليم",
      advice:
        "شجرة الكرز سليمة! حافظ على ممارسات الري الجيدة والتقليم السنوي ومراقبة الآفات. احمِ الثمار من الطيور عند النضج.",
    },
  },
  "Corn_(maize)__Cercospora_leaf_spot Gray_leaf_spot": {
    en: {
      displayName: "Corn - Gray Leaf Spot",
      advice:
        "Rotate crops to break the disease cycle. Use resistant corn hybrids. Apply foliar fungicide (strobilurin) if infection is severe. Ensure proper plant spacing for air circulation.",
    },
    ar: {
      displayName: "ذرة - بقعة الأوراق الرمادية",
      advice:
        "قم بتدوير المحاصيل لكسر دورة المرض. استخدم هجائن ذرة مقاومة. استخدم مبيد فطري ورقي (ستروبيلورين) إذا كانت الإصابة شديدة. تأكد من التباعد المناسب بين النباتات.",
    },
  },
  "Corn_(maize)__Common_rust_": {
    en: {
      displayName: "Corn - Common Rust",
      advice:
        "Plant resistant hybrids. Apply fungicide (triazole-based) if pustules appear before tasseling. Monitor fields regularly during warm, humid weather. Early planting can help avoid peak rust periods.",
    },
    ar: {
      displayName: "ذرة - الصدأ الشائع",
      advice:
        "ازرع هجائن مقاومة. استخدم مبيد فطري (قائم على ترايازول) إذا ظهرت البثرات قبل التزهير. راقب الحقول بانتظام خلال الطقس الدافئ والرطب. الزراعة المبكرة تساعد في تجنب ذروة الصدأ.",
    },
  },
  "Corn_(maize)__Northern_Leaf_Blight": {
    en: {
      displayName: "Corn - Northern Leaf Blight",
      advice:
        "Use resistant corn hybrids. Apply foliar fungicide at the first sign of lesions. Practice crop rotation with non-host crops. Remove crop debris after harvest to reduce inoculum.",
    },
    ar: {
      displayName: "ذرة - لفحة الأوراق الشمالية",
      advice:
        "استخدم هجائن ذرة مقاومة. استخدم مبيد فطري ورقي عند أول ظهور للآفات. مارس تدوير المحاصيل مع محاصيل غير مضيفة. أزل بقايا المحصول بعد الحصاد لتقليل مصدر العدوى.",
    },
  },
  "Corn_(maize)__healthy": {
    en: {
      displayName: "Corn - Healthy",
      advice:
        "Your corn plant is healthy! Maintain consistent watering, proper fertilization with nitrogen, and monitor for pests. Ensure adequate spacing between plants.",
    },
    ar: {
      displayName: "ذرة - سليم",
      advice:
        "نبتة الذرة سليمة! حافظ على الري المنتظم والتسميد المناسب بالنيتروجين ومراقبة الآفات. تأكد من التباعد الكافي بين النباتات.",
    },
  },
  "Grape__Black_rot": {
    en: {
      displayName: "Grape - Black Rot",
      advice:
        "Remove mummified berries and infected canes. Apply fungicide (myclobutanil or mancozeb) from bud break to veraison. Ensure good canopy management for air flow. Prune vines to reduce density.",
    },
    ar: {
      displayName: "عنب - العفن الأسود",
      advice:
        "أزل التوت المتحلل والعصي المصابة. استخدم مبيد فطري (مايكلوبيوتانيل أو مانكوزيب) من تفتح البراعم حتى التلوين. حسّن إدارة المظلة الورقية لتدفق الهواء.",
    },
  },
  "Grape__Esca_(Black_Measles)": {
    en: {
      displayName: "Grape - Esca (Black Measles)",
      advice:
        "No cure exists — manage by removing severely infected vines. Avoid large pruning wounds. Apply wound protectant after pruning. Maintain vine health through proper nutrition and water management.",
    },
    ar: {
      displayName: "عنب - إسكا (الحصبة السوداء)",
      advice:
        "لا يوجد علاج — أدر المرض بإزالة الكروم المصابة بشدة. تجنب جروح التقليم الكبيرة. استخدم حامي جروح بعد التقليم. حافظ على صحة الكرمة من خلال التغذية وإدارة المياه المناسبة.",
    },
  },
  "Grape__Leaf_blight_(Isariopsis_Leaf_Spot)": {
    en: {
      displayName: "Grape - Leaf Blight",
      advice:
        "Apply copper-based fungicide or mancozeb. Remove infected leaves to reduce spread. Improve air circulation through canopy management. Avoid working in the vineyard when foliage is wet.",
    },
    ar: {
      displayName: "عنب - لفحة الأوراق",
      advice:
        "استخدم مبيد فطري قائم على النحاس أو مانكوزيب. أزل الأوراق المصابة لتقليل الانتشار. حسّن دوران الهواء عبر إدارة المظلة الورقية. تجنب العمل في الكرم عندما يكون الورق مبللاً.",
    },
  },
  "Grape__healthy": {
    en: {
      displayName: "Grape - Healthy",
      advice:
        "Your grapevine is healthy! Continue regular pruning, balanced fertilization, and pest monitoring. Ensure proper trellising and canopy management.",
    },
    ar: {
      displayName: "عنب - سليم",
      advice:
        "كرمة العنب سليمة! استمر في التقليم المنتظم والتسميد المتوازن ومراقبة الآفات. تأكد من التعريش وإدارة المظلة الورقية بشكل صحيح.",
    },
  },
  "Orange__Haunglongbing_(Citrus_greening)": {
    en: {
      displayName: "Orange - Citrus Greening (HLB)",
      advice:
        "No cure exists. Remove and destroy infected trees to prevent spread. Control the Asian citrus psyllid vector with insecticide. Plant disease-free nursery stock. Report to local agricultural authorities.",
    },
    ar: {
      displayName: "برتقال - اخضرار الحمضيات",
      advice:
        "لا يوجد علاج. أزل وأتلف الأشجار المصابة لمنع الانتشار. كافح حشرة سيليد الحمضيات الآسيوية بالمبيدات. ازرع شتلات خالية من المرض. أبلغ السلطات الزراعية المحلية.",
    },
  },
  "Peach__Bacterial_spot": {
    en: {
      displayName: "Peach - Bacterial Spot",
      advice:
        "Apply copper-based bactericide in early spring. Avoid overhead irrigation. Plant resistant varieties. Remove and destroy infected leaves and fruit. Ensure good air circulation through pruning.",
    },
    ar: {
      displayName: "خوخ - البقعة البكتيرية",
      advice:
        "استخدم مبيد بكتيري قائم على النحاس في أوائل الربيع. تجنب الري العلوي. ازرع أصناف مقاومة. أزل وأتلف الأوراق والثمار المصابة. تأكد من دوران الهواء الجيد عبر التقليم.",
    },
  },
  "Peach__healthy": {
    en: {
      displayName: "Peach - Healthy",
      advice:
        "Your peach tree is healthy! Continue proper watering, annual pruning, and thinning fruit for better quality. Apply dormant spray in late winter.",
    },
    ar: {
      displayName: "خوخ - سليم",
      advice:
        "شجرة الخوخ سليمة! استمر في الري المناسب والتقليم السنوي وتخفيف الثمار للحصول على جودة أفضل. استخدم رش وقائي في أواخر الشتاء.",
    },
  },
  "Potato__Early_blight": {
    en: {
      displayName: "Potato - Early Blight",
      advice:
        "Apply fungicide (chlorothalonil or mancozeb) at first sign of spots. Practice crop rotation (3-year cycle). Remove infected plant debris. Ensure adequate plant spacing and avoid overhead irrigation.",
    },
    ar: {
      displayName: "بطاطا - اللفحة المبكرة",
      advice:
        "استخدم مبيد فطري (كلوروثالونيل أو مانكوزيب) عند أول ظهور للبقع. مارس تدوير المحاصيل (دورة 3 سنوات). أزل بقايا النباتات المصابة. تأكد من التباعد الكافي وتجنب الري العلوي.",
    },
  },
  "Potato__Late_blight": {
    en: {
      displayName: "Potato - Late Blight",
      advice:
        "Act immediately — this disease spreads rapidly. Apply fungicide (metalaxyl or chlorothalonil). Destroy all infected plants and tubers. Avoid overhead watering. Monitor weather conditions (cool, humid = high risk).",
    },
    ar: {
      displayName: "بطاطا - اللفحة المتأخرة",
      advice:
        "تصرف فوراً — هذا المرض ينتشر بسرعة. استخدم مبيد فطري (ميتالاكسيل أو كلوروثالونيل). أتلف جميع النباتات والدرنات المصابة. تجنب الري العلوي. راقب الأحوال الجوية (بارد ورطب = خطر عالٍ).",
    },
  },
  "Potato__healthy": {
    en: {
      displayName: "Potato - Healthy",
      advice:
        "Your potato plant is healthy! Maintain consistent watering, hill soil around stems, and monitor for Colorado potato beetles and other pests.",
    },
    ar: {
      displayName: "بطاطا - سليم",
      advice:
        "نبتة البطاطا سليمة! حافظ على الري المنتظم وتكويم التربة حول السيقان ومراقبة خنافس كولورادو والآفات الأخرى.",
    },
  },
  "Strawberry__Leaf_scorch": {
    en: {
      displayName: "Strawberry - Leaf Scorch",
      advice:
        "Remove and destroy infected leaves. Apply fungicide (captan) in early spring. Improve air circulation by spacing plants properly. Avoid overhead watering. Renovate beds after harvest.",
    },
    ar: {
      displayName: "فراولة - حرق الأوراق",
      advice:
        "أزل وأتلف الأوراق المصابة. استخدم مبيد فطري (كابتان) في أوائل الربيع. حسّن دوران الهواء بتباعد النباتات بشكل صحيح. تجنب الري العلوي. جدد الأحواض بعد الحصاد.",
    },
  },
  "Strawberry__healthy": {
    en: {
      displayName: "Strawberry - Healthy",
      advice:
        "Your strawberry plant is healthy! Keep soil moist but not waterlogged, use mulch to prevent fruit rot, and remove runners to focus energy on fruit production.",
    },
    ar: {
      displayName: "فراولة - سليم",
      advice:
        "نبتة الفراولة سليمة! حافظ على رطوبة التربة دون إغراقها واستخدم التغطية لمنع تعفن الثمار وأزل السيقان الجارية لتركيز الطاقة على إنتاج الثمار.",
    },
  },
  "Tomato__Bacterial_spot": {
    en: {
      displayName: "Tomato - Bacterial Spot",
      advice:
        "Apply copper-based bactericide. Use disease-free seeds and transplants. Practice crop rotation (2-3 years). Avoid overhead irrigation. Remove heavily infected plants to prevent spread.",
    },
    ar: {
      displayName: "طماطم - البقعة البكتيرية",
      advice:
        "استخدم مبيد بكتيري قائم على النحاس. استخدم بذور وشتلات خالية من المرض. مارس تدوير المحاصيل (2-3 سنوات). تجنب الري العلوي. أزل النباتات المصابة بشدة لمنع الانتشار.",
    },
  },
  "Tomato__Early_blight": {
    en: {
      displayName: "Tomato - Early Blight",
      advice:
        "Apply fungicide (chlorothalonil or copper-based). Mulch around plants to prevent soil splash. Practice crop rotation. Remove lower leaves that touch the ground. Water at the base, not overhead.",
    },
    ar: {
      displayName: "طماطم - اللفحة المبكرة",
      advice:
        "استخدم مبيد فطري (كلوروثالونيل أو قائم على النحاس). ضع تغطية حول النباتات لمنع رشاش التربة. مارس تدوير المحاصيل. أزل الأوراق السفلية الملامسة للأرض. اروِ من القاعدة وليس من الأعلى.",
    },
  },
  "Tomato__Late_blight": {
    en: {
      displayName: "Tomato - Late Blight",
      advice:
        "Act immediately — highly destructive. Apply fungicide (metalaxyl or chlorothalonil). Remove and destroy all infected plants. Do not compost infected material. Monitor during cool, wet weather.",
    },
    ar: {
      displayName: "طماطم - اللفحة المتأخرة",
      advice:
        "تصرف فوراً — مدمر للغاية. استخدم مبيد فطري (ميتالاكسيل أو كلوروثالونيل). أزل وأتلف جميع النباتات المصابة. لا تسمّد بالمواد المصابة. راقب خلال الطقس البارد والرطب.",
    },
  },
  "Tomato__Leaf_Mold": {
    en: {
      displayName: "Tomato - Leaf Mold",
      advice:
        "Improve greenhouse ventilation and reduce humidity. Apply fungicide (chlorothalonil). Remove infected leaves. Avoid overhead watering. Space plants for better air circulation.",
    },
    ar: {
      displayName: "طماطم - عفن الأوراق",
      advice:
        "حسّن تهوية الدفيئة وقلل الرطوبة. استخدم مبيد فطري (كلوروثالونيل). أزل الأوراق المصابة. تجنب الري العلوي. باعد بين النباتات لتحسين دوران الهواء.",
    },
  },
  "Tomato__Septoria_leaf_spot": {
    en: {
      displayName: "Tomato - Septoria Leaf Spot",
      advice:
        "Apply fungicide (chlorothalonil or copper-based) at first sign. Remove infected lower leaves. Mulch to prevent soil splash. Rotate crops and do not plant tomatoes in the same spot for 2 years.",
    },
    ar: {
      displayName: "طماطم - بقعة سبتوريا",
      advice:
        "استخدم مبيد فطري (كلوروثالونيل أو قائم على النحاس) عند أول ظهور. أزل الأوراق السفلية المصابة. استخدم تغطية لمنع رشاش التربة. قم بتدوير المحاصيل ولا تزرع الطماطم في نفس المكان لمدة سنتين.",
    },
  },
  "Tomato__Spider_mites Two-spotted_spider_mite": {
    en: {
      displayName: "Tomato - Spider Mites",
      advice:
        "Spray plants with strong water jet to dislodge mites. Apply miticide or insecticidal soap. Introduce predatory mites (Phytoseiulus persimilis). Avoid dusty conditions. Maintain adequate humidity.",
    },
    ar: {
      displayName: "طماطم - العنكبوت الأحمر",
      advice:
        "رش النباتات بتيار ماء قوي لإزاحة العث. استخدم مبيد عث أو صابون مبيد حشري. أدخل عث مفترس (فايتوسيولس بيرسيميليس). تجنب الظروف المغبرة. حافظ على رطوبة كافية.",
    },
  },
  "Tomato__Tomato_mosaic_virus": {
    en: {
      displayName: "Tomato - Mosaic Virus",
      advice:
        "No chemical cure exists. Remove and destroy infected plants immediately. Disinfect tools with 10% bleach solution. Wash hands before handling plants. Use resistant varieties. Do not smoke near plants (tobacco mosaic cross-infection).",
    },
    ar: {
      displayName: "طماطم - فيروس الفسيفساء",
      advice:
        "لا يوجد علاج كيميائي. أزل وأتلف النباتات المصابة فوراً. عقّم الأدوات بمحلول مبيض 10%. اغسل يديك قبل التعامل مع النباتات. استخدم أصناف مقاومة. لا تدخن بالقرب من النباتات.",
    },
  },
  "Tomato__healthy": {
    en: {
      displayName: "Tomato - Healthy",
      advice:
        "Your tomato plant is healthy! Continue consistent watering, staking or caging for support, and regular fertilizing. Monitor for pests like hornworms and aphids.",
    },
    ar: {
      displayName: "طماطم - سليم",
      advice:
        "نبتة الطماطم سليمة! استمر في الري المنتظم والدعم بالأوتاد أو الأقفاص والتسميد المنتظم. راقب الآفات مثل دودة القرن والمن.",
    },
  },
};

/** UI labels for the disease detection screen */
export const SCREEN_LABELS = {
  en: {
    cropHealth: "Crop Health",
    captureOrUpload: "Capture or Upload",
    captureImage: "Capture Image",
    useCamera: "Use camera",
    uploadImage: "Upload Image",
    fromGallery: "From gallery",
    loadingModel: "Loading AI model...",
    analyzingLeaf: "Analyzing leaf...",
    confidence: "confidence",
    plant: "Plant",
    disease: "Disease",
    topPredictions: "Top predictions:",
    diagnosisHistory: "Diagnosis History",
    noHistory: "No diagnoses yet. Capture or upload a leaf photo to get started.",
    proTips: "Pro Tips for Best Results",
    tip1: "Take clear, well-lit photos",
    tip2: "Focus on affected leaf areas",
    tip3: "Include multiple angles if possible",
    tip4: "Clean the lens before capture",
    treatmentAdvice: "Treatment Advice",
    healthyAdvice: "Plant Care Tips",
    segmentation: "Segmentation Analysis",
    segmentingLeaf: "Running segmentation...",
    segmentationFailed: "Segmentation unavailable",
    regionsDetected: "regions detected",
    aiEnhancing: "Generating personalized advice...",
    aiPoweredBadge: "AI",
    askFollowUp: "Ask a follow-up",
    closeChat: "Close",
    chatTitle: "Ask the AI Advisor",
    chatPlaceholder: "Ask anything about this diagnosis...",
    chatSend: "Send",
    chatThinking: "Thinking...",
    chatError: "Couldn't reach the advisor. Try again.",
    chatEmpty: "Ask a question about your diagnosis. For example:",
    chatSuggestion1: "Is this disease contagious to my other plants?",
    chatSuggestion2: "How long until I see improvement?",
    chatSuggestion3: "Can I still eat the fruit from this plant?",
  },
  ar: {
    cropHealth: "صحة المحاصيل",
    captureOrUpload: "التقاط أو رفع",
    captureImage: "التقاط صورة",
    useCamera: "استخدم الكاميرا",
    uploadImage: "رفع صورة",
    fromGallery: "من المعرض",
    loadingModel: "جاري تحميل نموذج الذكاء الاصطناعي...",
    analyzingLeaf: "جاري تحليل الورقة...",
    confidence: "الثقة",
    plant: "النبات",
    disease: "المرض",
    topPredictions: "أعلى التنبؤات:",
    diagnosisHistory: "سجل التشخيص",
    noHistory: "لا توجد تشخيصات بعد. التقط أو ارفع صورة ورقة للبدء.",
    proTips: "نصائح للحصول على أفضل النتائج",
    tip1: "التقط صوراً واضحة وجيدة الإضاءة",
    tip2: "ركّز على المناطق المصابة من الورقة",
    tip3: "قم بتضمين زوايا متعددة إن أمكن",
    tip4: "نظّف العدسة قبل التصوير",
    treatmentAdvice: "نصائح العلاج",
    healthyAdvice: "نصائح العناية بالنبات",
    segmentation: "تحليل التجزئة",
    segmentingLeaf: "جاري تحليل التجزئة...",
    segmentationFailed: "التجزئة غير متاحة",
    regionsDetected: "مناطق مكتشفة",
    aiEnhancing: "جاري إنشاء نصائح مخصصة...",
    aiPoweredBadge: "ذكاء اصطناعي",
    askFollowUp: "اسأل سؤالاً للمتابعة",
    closeChat: "إغلاق",
    chatTitle: "اسأل المستشار الذكي",
    chatPlaceholder: "اسأل أي شيء حول هذا التشخيص...",
    chatSend: "إرسال",
    chatThinking: "جاري التفكير...",
    chatError: "تعذر الوصول إلى المستشار. حاول مرة أخرى.",
    chatEmpty: "اطرح سؤالاً حول تشخيصك. على سبيل المثال:",
    chatSuggestion1: "هل هذا المرض معدٍ للنباتات الأخرى؟",
    chatSuggestion2: "متى سأرى تحسناً؟",
    chatSuggestion3: "هل يمكنني تناول ثمار هذا النبات؟",
  },
};
