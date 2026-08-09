(() => {
  "use strict";

  const classifiers = [
    ["ge", "个", "gè", "Phổ dụng", "người, bạn, bạn học, táo, cốc, bát, chữ, tên, số điện thoại, đồ vật", "Lượng từ thông dụng nhất. Dùng khi danh từ không có lượng từ chuyên biệt hoặc trong cách nói thông thường.", "我有一个中国朋友。"],
    ["wei", "位", "wèi", "Người", "thầy cô, bác sĩ, ông, cô, người cần gọi trang trọng", "Dùng cho người với sắc thái lịch sự, tôn trọng.", "那位老师是王老师。"],
    ["ming", "名", "míng", "Người", "học sinh, giáo viên, bác sĩ", "Dùng để đếm thành viên của một nhóm hoặc người có nghề nghiệp, thường gặp trong văn viết.", "医院里有三名医生。"],
    ["kou", "口", "kǒu", "Gia đình", "người trong một gia đình", "Dùng để đếm nhân khẩu trong gia đình.", "我家有五口人。"],
    ["ben", "本", "běn", "Sách", "sách, sách tiếng Hán", "Dùng cho sách và tài liệu được đóng thành quyển.", "桌子上有两本汉语书。"],
    ["zhang", "张", "zhāng", "Mặt phẳng", "bàn, báo, tờ giấy", "Dùng cho vật có mặt phẳng hoặc có thể trải ra.", "桌子上有一张报纸。"],
    ["fen", "份", "fèn", "Phần, bản", "báo, công việc, phần ăn", "Nhấn mạnh một bản, một phần hoặc một suất riêng.", "爸爸每天看一份报纸。"],
    ["dao", "道", "dào", "Món ăn", "món ăn, món Trung Quốc", "Dùng để đếm từng món được nấu và dọn riêng.", "妈妈做了三道中国菜。"],
    ["pan", "盘", "pán", "Đĩa thức ăn", "trái cây, món ăn", "Đơn vị theo vật chứa: một đĩa đầy thức ăn hoặc trái cây.", "桌子上有一盘水果。"],
    ["bei", "杯", "bēi", "Cốc đồ uống", "trà, nước, sữa", "Đơn vị theo vật chứa: lượng chất lỏng trong một cốc.", "我想喝一杯牛奶。"],
    ["wan", "碗", "wǎn", "Bát thức ăn", "cơm, nước, trà", "Đơn vị theo vật chứa: lượng thức ăn hoặc chất lỏng trong một bát.", "他吃了两碗米饭。"],
    ["ping", "瓶", "píng", "Chai, lọ", "nước, trà, sữa, thuốc", "Đơn vị theo vật chứa: lượng ở trong một chai hoặc lọ.", "我买了三瓶水。"],
    ["ba", "把", "bǎ", "Vật có tay cầm", "ghế", "Dùng cho vật có tay cầm hoặc có thể nắm bằng tay; trong bài đã học dùng với 椅子.", "房间里有四把椅子。"],
    ["jia", "家", "jiā", "Cơ sở", "bệnh viện, nhà hàng, cửa hàng, hiệu sách, trung tâm thương mại, rạp phim", "Dùng cho cơ sở kinh doanh hoặc tổ chức cung cấp dịch vụ.", "学校旁边有一家书店。"],
    ["suo", "所", "suǒ", "Cơ sở", "trường học, đại học, bệnh viện", "Dùng cho cơ sở giáo dục và một số cơ quan, tổ chức.", "这是一所很大的大学。"],
    ["zuo", "座", "zuò", "Công trình", "trường học, bệnh viện, rạp phim, trung tâm thương mại, nhà ga", "Nhấn mạnh một tòa nhà hoặc công trình có quy mô.", "火车站旁边有一座医院。"],
    ["tai", "台", "tái", "Máy móc", "máy tính, máy tính xách tay, tivi", "Dùng cho máy móc và thiết bị điện tử.", "房间里有一台电脑。"],
    ["bu", "部", "bù", "Tác phẩm", "phim", "Dùng để đếm tác phẩm điện ảnh.", "我们看了一部中国电影。"],
    ["chang", "场", "chǎng", "Sự kiện", "phim, mưa, trận bóng, hoạt động", "Dùng cho sự việc diễn ra trong một khoảng thời gian, có mở đầu và kết thúc.", "昨天有一场大雨。"],
    ["zhi", "只", "zhī", "Con, chiếc", "mèo, chó, mắt, cốc", "Dùng cho nhiều động vật, một chiếc trong một đôi và một số đồ vật nhỏ.", "桌子下面有一只猫。"],
    ["tiao", "条", "tiáo", "Dài, mềm", "cá", "Dùng cho vật hoặc động vật có hình dài; trong bài đã học dùng với 鱼.", "爸爸买了两条鱼。"],
    ["jian-clothes", "件", "jiàn", "Vật, sự việc", "quần áo, đồ vật", "Dùng cho quần áo và đồ vật được xem như một món riêng.", "我想买一件红色的衣服。"],
    ["kuai", "块", "kuài", "Khối, đồng", "đồng tiền, đồng hồ đeo tay", "Dùng cho đơn vị tiền 块钱 và một số vật nhỏ dạng khối; 手表 thường đi với 块 trong khẩu ngữ.", "这块手表多少钱？"],
    ["jian-room", "间", "jiān", "Phòng", "phòng", "Dùng để đếm phòng hoặc không gian có tường bao quanh.", "我家有三个房间。"],
    ["zhong", "种", "zhǒng", "Loại", "màu sắc, món ăn, trái cây, vận động", "Dùng khi phân loại người hoặc vật theo từng kiểu, từng loại.", "我喜欢这种颜色。"],
    ["shuang", "双", "shuāng", "Đôi", "mắt", "Dùng cho hai bộ phận hoặc đồ vật tạo thành một đôi.", "那只猫有一双大眼睛。"],
    ["liang", "辆", "liàng", "Xe", "xe, taxi", "Dùng cho phương tiện chạy bằng bánh xe.", "学校前面有两辆出租车。"],
    ["jia-plane", "架", "jià", "Máy bay", "máy bay", "Dùng cho máy bay và một số máy móc có khung lớn.", "天上有一架飞机。"],
    ["lie", "列", "liè", "Tàu", "tàu hỏa", "Dùng cho một đoàn tàu gồm nhiều toa nối nhau.", "这列火车去北京。"],
    ["dun", "顿", "dùn", "Bữa ăn", "cơm, bữa sáng, bữa trưa, bữa tối", "Dùng để đếm các bữa ăn.", "我们一起吃了一顿晚饭。"],
    ["pian", "片", "piàn", "Miếng mỏng", "thuốc dạng viên dẹt", "Dùng cho vật mỏng, phẳng; với 药 chỉ một viên thuốc dạng dẹt.", "这个药一次吃两片。"],
    ["bao", "包", "bāo", "Gói", "thuốc", "Đơn vị theo bao bì: lượng ở trong một gói.", "医生给了我三包药。"],
    ["tong", "通", "tōng", "Cuộc gọi", "điện thoại", "Dùng để đếm một lần nói chuyện qua điện thoại.", "我给妈妈打了一通电话。"],
    ["men", "门", "mén", "Môn học", "tiếng Hán, tiếng Hàn", "Dùng cho môn học hoặc môn thi.", "这个星期我学了两门语言。"],
    ["duan", "段", "duàn", "Đoạn", "thời gian, lời nói", "Dùng cho một phần có điểm đầu và điểm cuối, như một quãng thời gian.", "那段时间我很忙。"],
    ["ci", "次", "cì", "Số lần", "hành động, hoạt động, du lịch", "Đặt sau số để đếm số lần một hành động xảy ra.", "我去过北京两次。"],
    ["tian", "天", "tiān", "Thời gian", "ngày", "Đơn vị thời gian bằng một ngày; số đặt trực tiếp trước 天.", "我在北京住了三天。"],
    ["nian", "年", "nián", "Thời gian", "năm", "Đơn vị thời gian bằng một năm; không dùng 个 ở giữa số và 年.", "他在中国住了五年。"],
    ["sui", "岁", "suì", "Tuổi", "tuổi của người", "Đặt sau số để biểu thị tuổi.", "我女儿今年八岁。"],
    ["xiaoshi", "小时", "xiǎoshí", "Thời gian", "giờ kéo dài", "Dùng cho độ dài thời gian tính bằng giờ, khác 点 là giờ trên đồng hồ.", "我每天学习两个小时。"],
    ["fenzhong", "分钟", "fēnzhōng", "Thời gian", "phút", "Dùng cho độ dài thời gian tính bằng phút.", "坐出租车要二十分钟。"],
    ["mi", "米", "mǐ", "Độ dài", "mét, chiều cao", "Đơn vị đo độ dài; số đặt trực tiếp trước 米.", "他有一米八。"],
    ["ke", "刻", "kè", "Thời gian", "mười lăm phút", "Trong cách nói giờ, 一刻 là mười lăm phút và 三刻 là bốn mươi lăm phút.", "现在三点一刻。"]
  ].map(([id, hanzi, pinyin, group, nouns, explanation, example]) => ({
    id, hanzi, pinyin, group, nouns, explanation, example
  }));

  const pairs = [
    ["ge-friend", "朋友", "một người bạn Trung Quốc", "我有一___中国朋友。", "个"],
    ["ge-classmate", "同学", "ba người bạn học", "我认识三___同学。", "个"],
    ["ge-person", "人", "người ở phía trước", "前面有一___人。", "个"],
    ["ge-apple", "苹果", "năm quả táo", "妈妈买了五___苹果。", "个"],
    ["ge-cup", "杯子", "hai cái cốc", "桌子上有两___杯子。", "个"],
    ["ge-bowl", "碗", "bốn cái bát", "商店里有四___碗。", "个"],
    ["ge-character", "汉字", "mười chữ Hán", "今天我写了十___汉字。", "个"],
    ["ge-name", "名字", "một cái tên hay", "她有一___很好听的名字。", "个"],
    ["ge-number", "电话号码", "hai số điện thoại", "我有两___电话号码。", "个"],
    ["ge-thing", "东西", "một món đồ mới", "我买了一___新东西。", "个"],
    ["wei-teacher", "老师", "một giáo viên, cách nói lịch sự", "那___老师姓王。", "位"],
    ["wei-doctor", "医生", "hai bác sĩ, cách nói lịch sự", "医院里有两___医生。", "位"],
    ["wei-mister", "先生", "vị tiên sinh ở phía trước", "前面那___先生是我爸爸。", "位"],
    ["wei-miss", "小姐", "vị tiểu thư vừa đến", "来了一___小姐。", "位"],
    ["ming-student", "学生", "mười lăm học sinh trong nhóm", "这所学校有十五___学生。", "名"],
    ["ming-teacher", "老师", "ba giáo viên trong danh sách", "学校来了三___新老师。", "名"],
    ["ming-doctor", "医生", "năm bác sĩ của bệnh viện", "这家医院有五___医生。", "名"],
    ["kou-family-four", "人", "gia đình bốn người", "他家有四___人。", "口"],
    ["kou-family-six", "人", "gia đình sáu người", "王老师家有六___人。", "口"],
    ["ben-book-one", "书", "một quyển sách", "桌子上有一___书。", "本"],
    ["ben-book-three", "书", "ba quyển sách mới", "我买了三___新书。", "本"],
    ["ben-chinese", "汉语书", "hai quyển sách tiếng Hán", "她有两___汉语书。", "本"],
    ["ben-that-book", "书", "quyển sách kia", "那___书是谁的？", "本"],
    ["zhang-table", "桌子", "một cái bàn", "房间里有一___桌子。", "张"],
    ["zhang-tables", "桌子", "ba cái bàn", "学校里有三___桌子。", "张"],
    ["zhang-paper", "报纸", "một tờ báo trên bàn", "桌子上有一___报纸。", "张"],
    ["zhang-newspaper", "报纸", "hai tờ báo hôm nay", "爸爸买了两___今天的报纸。", "张"],
    ["fen-newspaper", "报纸", "một bản báo mỗi ngày", "爷爷每天看一___报纸。", "份"],
    ["fen-work", "工作", "một công việc mới", "她有一___新工作。", "份"],
    ["dao-dish", "菜", "hai món ăn ngon", "妈妈做了两___好吃的菜。", "道"],
    ["dao-chinese", "中国菜", "ba món Trung Quốc", "我们点了三___中国菜。", "道"],
    ["dao-this-dish", "菜", "món này", "这___菜太好吃了。", "道"],
    ["pan-fruit", "水果", "một đĩa trái cây", "桌子上有一___水果。", "盘"],
    ["pan-dish", "中国菜", "hai đĩa món Trung Quốc", "饭桌上有两___中国菜。", "盘"],
    ["bei-tea", "茶", "một cốc trà", "请喝一___茶。", "杯"],
    ["bei-water", "水", "hai cốc nước", "我喝了两___水。", "杯"],
    ["bei-milk", "牛奶", "một cốc sữa", "早上我喝一___牛奶。", "杯"],
    ["bei-hot-water", "水", "ba cốc nước nóng", "他想喝三___热水。", "杯"],
    ["bei-that-tea", "茶", "cốc trà kia", "那___茶是谁的？", "杯"],
    ["wan-rice", "米饭", "hai bát cơm", "哥哥吃了两___米饭。", "碗"],
    ["wan-meal", "饭", "một bát cơm", "我只吃了一___饭。", "碗"],
    ["wan-water", "水", "một bát nước", "桌子下面有一___水。", "碗"],
    ["wan-rice-three", "米饭", "ba bát cơm", "他们一共吃了三___米饭。", "碗"],
    ["ping-water", "水", "ba chai nước", "我买了三___水。", "瓶"],
    ["ping-tea", "茶", "một chai trà", "桌子上有一___茶。", "瓶"],
    ["ping-milk", "牛奶", "hai chai sữa", "商店送了两___牛奶。", "瓶"],
    ["ping-medicine", "药", "một lọ thuốc", "房间里有一___药。", "瓶"],
    ["ba-chair", "椅子", "một cái ghế", "桌子旁边有一___椅子。", "把"],
    ["ba-chairs", "椅子", "bốn cái ghế", "这个房间有四___椅子。", "把"],
    ["jia-hospital", "医院", "một bệnh viện", "学校旁边有一___医院。", "家"],
    ["jia-restaurant", "饭馆儿", "hai nhà hàng", "前面有两___饭馆儿。", "家"],
    ["jia-hotel", "饭店", "nhà hàng kia", "那___饭店的菜很好吃。", "家"],
    ["jia-shop", "商店", "ba cửa hàng", "这儿有三___商店。", "家"],
    ["jia-bookshop", "书店", "một hiệu sách mới", "学校前面有一___新书店。", "家"],
    ["jia-mall", "商场", "hai trung tâm thương mại", "那边有两___大商场。", "家"],
    ["jia-cinema", "电影院", "một rạp phim", "我家后面有一___电影院。", "家"],
    ["suo-school", "学校", "một trường học", "这是一___学校。", "所"],
    ["suo-schools", "学校", "ba trường học", "这儿有三___学校。", "所"],
    ["suo-university", "大学", "một trường đại học", "北京有一___很大的大学。", "所"],
    ["suo-hospital", "医院", "hai bệnh viện với tư cách cơ sở", "这个城市有两___医院。", "所"],
    ["zuo-station", "火车站", "một nhà ga", "前面有一___火车站。", "座"],
    ["zuo-hospital", "医院", "một tòa bệnh viện lớn", "那是一___大医院。", "座"],
    ["zuo-mall", "商场", "một tòa trung tâm thương mại", "学校后面有一___商场。", "座"],
    ["zuo-cinema", "电影院", "một tòa rạp phim mới", "这儿有一___新电影院。", "座"],
    ["tai-computer", "电脑", "một máy tính", "桌子上有一___电脑。", "台"],
    ["tai-computers", "电脑", "năm máy tính", "学校买了五___电脑。", "台"],
    ["tai-laptop", "笔记本电脑", "hai máy tính xách tay", "他有两___笔记本电脑。", "台"],
    ["tai-tv", "电视", "một chiếc tivi", "房间里有一___电视。", "台"],
    ["bu-film", "电影", "một bộ phim Trung Quốc", "我们看了一___中国电影。", "部"],
    ["bu-films", "电影", "ba bộ phim mới", "这个星期我看了三___新电影。", "部"],
    ["bu-that-film", "电影", "bộ phim kia", "那___电影怎么样？", "部"],
    ["chang-rain", "雨", "một trận mưa lớn", "昨天下了一___大雨。", "场"],
    ["chang-football", "足球", "một trận bóng đá", "下午我们看了一___足球。", "场"],
    ["chang-film", "电影", "một suất phim", "晚上有一___电影。", "场"],
    ["zhi-cat", "猫", "một con mèo", "桌子下面有一___猫。", "只"],
    ["zhi-cats", "猫", "ba con mèo nhỏ", "她有三___小猫。", "只"],
    ["zhi-dog", "狗", "hai con chó", "房间外面有两___狗。", "只"],
    ["zhi-eye", "眼睛", "một mắt", "它的一___眼睛是红色的。", "只"],
    ["zhi-cup", "杯子", "một chiếc cốc", "桌子上只有一___杯子。", "只"],
    ["tiao-fish", "鱼", "một con cá", "爸爸买了一___鱼。", "条"],
    ["tiao-fishes", "鱼", "bốn con cá", "水里有四___鱼。", "条"],
    ["tiao-red-fish", "鱼", "hai con cá đỏ", "我看见两___红色的鱼。", "条"],
    ["jian-red-clothes", "衣服", "một món quần áo màu đỏ", "我想买一___红色的衣服。", "件"],
    ["jian-clothes-three", "衣服", "ba món quần áo", "她买了三___衣服。", "件"],
    ["jian-new-clothes", "衣服", "hai món quần áo mới", "妈妈送了我两___新衣服。", "件"],
    ["jian-thing", "东西", "một món đồ", "桌子上有一___东西。", "件"],
    ["kuai-money", "钱", "mười đồng", "这本书十___钱。", "块"],
    ["kuai-apple-price", "钱", "ba đồng", "一个苹果三___钱。", "块"],
    ["kuai-watch", "手表", "một chiếc đồng hồ", "丈夫送了我一___手表。", "块"],
    ["kuai-pink-watch", "手表", "chiếc đồng hồ màu hồng kia", "那___粉色的手表真漂亮。", "块"],
    ["jian-room-one", "房间", "một căn phòng", "我家有一___房间。", "间"],
    ["jian-room-three", "房间", "ba căn phòng", "这家饭店有三___房间。", "间"],
    ["jian-room-this", "房间", "căn phòng này", "这___房间很大。", "间"],
    ["zhong-color", "颜色", "một loại màu sắc", "我喜欢这___颜色。", "种"],
    ["zhong-colors", "颜色", "ba loại màu sắc", "这件衣服有三___颜色。", "种"],
    ["zhong-dish", "中国菜", "hai loại món Trung Quốc", "饭馆儿有两___中国菜。", "种"],
    ["zhong-sport", "运动", "một loại vận động", "跑步是一___运动。", "种"],
    ["shuang-eyes", "眼睛", "một đôi mắt", "花花有一___大眼睛。", "双"],
    ["shuang-red-eyes", "眼睛", "một đôi mắt màu đỏ", "那只猫有一___红色的眼睛。", "双"],
    ["liang-car", "车", "một chiếc xe", "学校前面有一___车。", "辆"],
    ["liang-cars", "车", "ba chiếc xe", "外面有三___车。", "辆"],
    ["liang-taxi", "出租车", "hai chiếc taxi", "饭店旁边有两___出租车。", "辆"],
    ["jia-plane-one", "飞机", "một chiếc máy bay", "天上有一___飞机。", "架"],
    ["jia-plane-two", "飞机", "hai chiếc máy bay", "我看见了两___飞机。", "架"],
    ["lie-train", "火车", "một đoàn tàu", "这___火车去北京。", "列"],
    ["lie-trains", "火车", "hai đoàn tàu", "火车站里有两___火车。", "列"],
    ["dun-meal", "饭", "một bữa cơm", "我们一起吃了一___饭。", "顿"],
    ["dun-breakfast", "早饭", "một bữa sáng", "我每天吃一___早饭。", "顿"],
    ["dun-lunch", "午饭", "hai bữa trưa", "他在饭馆儿吃了两___午饭。", "顿"],
    ["dun-dinner", "晚饭", "một bữa tối", "今天我给丈夫做了一___晚饭。", "顿"],
    ["dun-three-meals", "饭", "ba bữa cơm", "我每天吃三___饭。", "顿"],
    ["pian-medicine", "药", "hai viên thuốc", "这个药一次吃两___。", "片"],
    ["pian-medicine-three", "药", "ba viên thuốc dẹt", "桌子上有三___药。", "片"],
    ["bao-medicine", "药", "một gói thuốc", "医生给了我一___药。", "包"],
    ["bao-medicine-four", "药", "bốn gói thuốc", "妈妈买了四___药。", "包"],
    ["tong-phone", "电话", "một cuộc điện thoại", "我给老师打了一___电话。", "通"],
    ["tong-two-calls", "电话", "hai cuộc điện thoại", "丈夫给我打了两___电话。", "通"],
    ["men-chinese", "汉语", "một môn tiếng Hán", "我在大学学一___汉语课。", "门"],
    ["men-languages", "语言", "hai môn ngôn ngữ", "这个学期我学两___语言。", "门"],
    ["duan-time", "时间", "một quãng thời gian", "那___时间我很忙。", "段"],
    ["duan-short-time", "时间", "một quãng thời gian ngắn", "我想休息一___时间。", "段"],
    ["ci-travel", "旅游", "một chuyến du lịch", "今年我去北京旅游了一___。", "次"],
    ["ci-beijing", "去北京", "hai lần đi Bắc Kinh", "我去过北京两___。", "次"],
    ["ci-run", "跑步", "ba lần chạy bộ", "这个星期我跑了三___步。", "次"],
    ["ci-medicine", "吃药", "mỗi ngày uống thuốc hai lần", "这个药每天吃两___。", "次"],
    ["tian-three", "天", "ba ngày", "我在北京住了三___。", "天"],
    ["tian-seven", "天", "bảy ngày", "他生病了七___。", "天"],
    ["nian-five", "年", "năm năm", "王老师在中国住了五___。", "年"],
    ["nian-two", "年", "hai năm", "我学汉语学了两___。", "年"],
    ["sui-daughter", "岁", "con gái tám tuổi", "我女儿今年八___。", "岁"],
    ["sui-son", "岁", "con trai mười lăm tuổi", "他儿子十五___了。", "岁"],
    ["xiaoshi-study", "小时", "học trong hai giờ", "我每天学习两___。", "小时"],
    ["xiaoshi-sleep", "小时", "ngủ tám giờ", "弟弟每天睡八___。", "小时"],
    ["xiaoshi-movie", "小时", "bộ phim dài hai giờ", "这部电影有两___。", "小时"],
    ["fenzhong-taxi", "分钟", "đi taxi mất hai mươi phút", "坐出租车要二十___。", "分钟"],
    ["fenzhong-wait", "分钟", "đợi mười phút", "请等我十___。", "分钟"],
    ["fenzhong-run", "分钟", "chạy bộ ba mươi phút", "我每天跑步三十___。", "分钟"],
    ["mi-height", "米", "cao một mét tám", "他有一___八。", "米"],
    ["mi-distance", "米", "chạy hai nghìn mét", "今天我跑了两千___。", "米"],
    ["ke-quarter", "刻", "ba giờ mười lăm", "现在三点一___。", "刻"],
    ["ke-three-quarters", "刻", "bốn giờ bốn mươi lăm", "现在四点三___。", "刻"]
  ].map(([id, noun, target, sentence, classifier, accepted, explanation]) => ({
    id,
    noun,
    target,
    sentence,
    classifier,
    accepted: accepted || [classifier],
    explanation: explanation || `“${noun}” trong ngữ cảnh này dùng lượng từ “${classifier}”.`
  }));

  const numberUnits = [
    ["百", "bǎi", "100", "trăm", "一百零五", "105"],
    ["千", "qiān", "1.000", "nghìn", "两千零二十六", "2.026"],
    ["万", "wàn", "10.000", "vạn, tức mười nghìn", "一万二千三百四十五", "12.345"],
    ["十万", "shí wàn", "100.000", "mười vạn", "二十万", "200.000"],
    ["百万", "bǎi wàn", "1.000.000", "một trăm vạn, tức một triệu", "一百万", "1.000.000"],
    ["零", "líng", "số 0 ở giữa", "đọc một lần khi có hàng bị khuyết", "一千零五", "1.005"]
  ].map(([hanzi, pinyin, value, meaning, example, result]) => ({
    hanzi, pinyin, value, meaning, example, result
  }));

  const numberRules = [
    {
      title: "Ghép từ hàng lớn xuống hàng nhỏ",
      explanation: "Đọc lần lượt số + 千 + 百 + 十 + hàng đơn vị. Hàng nào bằng 0 thì xử lý theo quy tắc 零.",
      example: "三千四百五十六 = 3.456"
    },
    {
      title: "Từ 10 đến 19 bỏ 一 ở đầu",
      explanation: "10 đọc là 十, 11 là 十一, 15 là 十五. Từ 20 trở lên vẫn đọc số ở hàng chục.",
      example: "十五 = 15；二十五 = 25"
    },
    {
      title: "Khuyết một hoặc nhiều hàng ở giữa dùng một 零",
      explanation: "Dù khuyết một hay nhiều hàng liên tiếp, chỉ đọc một 零 giữa hai phần có số.",
      example: "一百零五 = 105；一千零五 = 1.005；一万零五 = 10.005"
    },
    {
      title: "Số 0 ở cuối không đọc",
      explanation: "Khi các hàng cuối đều bằng 0, dừng ở hàng cuối cùng có số khác 0.",
      example: "一百二十 = 120；两千五百 = 2.500；三万 = 30.000"
    },
    {
      title: "Dùng 两 trước 百, 千 và 万 trong cách nói thông dụng",
      explanation: "两百, 两千 và 两万 tự nhiên trong giao tiếp. 二百, 二千 và 二万 vẫn có thể gặp khi đọc số theo kiểu trang trọng.",
      example: "两百二十二 = 222；两千零二十 = 2.020；两万 = 20.000"
    },
    {
      title: "万 là một nhóm bốn chữ số",
      explanation: "Tiếng Trung gom số theo vạn. Phần trước 万 cho biết có bao nhiêu vạn; sau đó tiếp tục đọc nghìn, trăm, chục và đơn vị.",
      example: "十二万三千四百五十六 = 123.456"
    }
  ];

  const chineseDigits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

  function underTenThousand(value, omitLeadingOne = true) {
    const digits = String(value).padStart(4, "0").split("").map(Number);
    const units = ["千", "百", "十", ""];
    let result = "";
    let pendingZero = false;

    digits.forEach((digit, index) => {
      if (digit === 0) {
        if (result && digits.slice(index + 1).some(next => next !== 0)) pendingZero = true;
        return;
      }
      if (pendingZero) result += "零";
      const useLiang = digit === 2 && (units[index] === "千" || units[index] === "百");
      result += `${useLiang ? "两" : chineseDigits[digit]}${units[index]}`;
      pendingZero = false;
    });

    return omitLeadingOne && result.startsWith("一十") ? result.slice(1) : result;
  }

  function numberToChinese(value) {
    if (value < 10000) return underTenThousand(value);
    const high = Math.floor(value / 10000);
    const low = value % 10000;
    const highText = high === 2 ? "两" : underTenThousand(high);
    if (low === 0) return `${highText}万`;
    const bridge = low < 1000 ? "零" : "";
    return `${highText}万${bridge}${underTenThousand(low, false)}`;
  }

  const numberValues = [
    100, 101, 105, 110, 111, 120, 125, 150, 199, 200, 201, 205, 210, 222,
    250, 299, 300, 304, 330, 365, 400, 404, 440, 488, 500, 550, 606, 666,
    707, 750, 808, 880, 909, 999,
    1000, 1001, 1005, 1010, 1011, 1050, 1090, 1100, 1101, 1110, 1111, 1200,
    1234, 1500, 1999, 2000, 2001, 2010, 2050, 2100, 2200, 2222, 2500, 3000,
    3003, 3030, 3300, 3456, 4000, 4040, 4444, 5005, 5050, 5500, 6006, 6600,
    7007, 7070, 8008, 8080, 9009, 9090, 9999,
    10000, 10001, 10005, 10010, 10011, 10050, 10100, 10101, 10500, 11000,
    11001, 11111, 12000, 12345, 15000, 19999, 20000, 20002, 20020, 20200,
    22000, 22222, 25000, 30003, 30303, 33000, 34567, 40004, 40404, 44444,
    50005, 50505, 55000, 60006, 60606, 66000, 70007, 70707, 77777, 80008,
    80808, 88000, 90009, 90909, 99999, 100000, 100001, 100010, 100100,
    101000, 110000, 123456, 200000, 202026, 220000, 500000, 999999, 1000000
  ].map(value => {
    const chinese = numberToChinese(value);
    const formal = chinese.replaceAll("两", "二");
    return {
      value,
      display: new Intl.NumberFormat("vi-VN").format(value),
      chinese,
      acceptedChinese: formal === chinese ? [chinese] : [chinese, formal]
    };
  });

  window.HSK_MEASURE_WORDS = {
    classifiers,
    pairs,
    largeNumbers: {
      units: numberUnits,
      rules: numberRules,
      values: numberValues,
      exerciseCount: numberValues.length * 2
    },
    exerciseCount: pairs.length * 2 + classifiers.length + numberValues.length * 2
  };
})();
