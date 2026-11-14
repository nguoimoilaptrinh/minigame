// Dữ liệu v2.6: Bộ từ khóa Gián Điệp ngắn gọn - gần gũi - đời thường, Khóa 100% Tiếng Việt Nam/Nữ, 11 Role Ma Sói
window.GameData = (() => {
  const APP_VERSION = 'v2.6';

  const PLAYER_AVATARS = [
    { id: 'friend_1', img: 'assets/avatars/friend_1.jpg', emoji: '🦇', label: 'Thành viên 1', bg: 'linear-gradient(135deg,#ec4899,#8b5cf6)' },
    { id: 'friend_2', img: 'assets/avatars/friend_2.jpg', emoji: '🍊', label: 'Thành viên 2', bg: 'linear-gradient(135deg,#f97316,#facc15)' },
    { id: 'friend_3', img: 'assets/avatars/friend_3.jpg', emoji: '👻', label: 'Thành viên 3', bg: 'linear-gradient(135deg,#6366f1,#0ea5e9)' },
    { id: 'friend_4', img: 'assets/avatars/friend_4.jpg', emoji: '🐱', label: 'Thành viên 4', bg: 'linear-gradient(135deg,#f472b6,#fb7185)' },
    { id: 'friend_5', img: 'assets/avatars/friend_5.jpg', emoji: '🕶️', label: 'Thành viên 5', bg: 'linear-gradient(135deg,#334155,#3b82f6)' },
    { id: 'friend_6', img: 'assets/avatars/friend_6.jpg', emoji: '⛰️', label: 'Thành viên 6', bg: 'linear-gradient(135deg,#10b981,#06b6d4)' },
    { id: 'friend_7', img: 'assets/avatars/friend_7.jpg', emoji: '👓', label: 'Thành viên 7', bg: 'linear-gradient(135deg,#38bdf8,#2563eb)' },
    { id: 'friend_8', img: 'assets/avatars/friend_8.jpg', emoji: '🖤', label: 'Thành viên 8', bg: 'linear-gradient(135deg,#475569,#7c3aed)' },
    { id: 'boy_smile', emoji: '👦', label: 'Nam vui vẻ', bg: 'linear-gradient(135deg,#38bdf8,#6366f1)' },
    { id: 'girl_smile', emoji: '👧', label: 'Nữ đáng yêu', bg: 'linear-gradient(135deg,#f472b6,#e11d48)' },
    { id: 'man_cool', emoji: '👨', label: 'Anh trai', bg: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' },
    { id: 'woman_chic', emoji: '👩', label: 'Chị đẹp', bg: 'linear-gradient(135deg,#ec4899,#a855f7)' },
    { id: 'man_beard', emoji: '🧔', label: 'Râu ngầu', bg: 'linear-gradient(135deg,#f59e0b,#b45309)' },
    { id: 'blond_boy', emoji: '👱‍♂️', label: 'Tóc vàng', bg: 'linear-gradient(135deg,#fbbf24,#f97316)' },
    { id: 'blond_girl', emoji: '👱‍♀️', label: 'Cô gái vàng', bg: 'linear-gradient(135deg,#fcd34d,#ec4899)' },
    { id: 'curly_hair', emoji: '🧑‍🦱', label: 'Tóc xoăn', bg: 'linear-gradient(135deg,#8b5cf6,#6366f1)' },
    { id: 'red_hair', emoji: '🧑‍🦰', label: 'Tóc đỏ', bg: 'linear-gradient(135deg,#ef4444,#f97316)' },
    { id: 'white_hair', emoji: '🧑‍🦳', label: 'Bạch kim', bg: 'linear-gradient(135deg,#94a3b8,#475569)' },
    { id: 'grandpa', emoji: '👴', label: 'Bô lão', bg: 'linear-gradient(135deg,#10b981,#0f766e)' },
    { id: 'grandma', emoji: '👵', label: 'Bà ngoại', bg: 'linear-gradient(135deg,#14b8a6,#0369a1)' },
    { id: 'glasses_nerd', emoji: '🤓', label: 'Mọt sách', bg: 'linear-gradient(135deg,#0ea5e9,#2563eb)' },
    { id: 'sunglasses', emoji: '😎', label: 'Kính râm', bg: 'linear-gradient(135deg,#6366f1,#0f172a)' },
    { id: 'monocle', emoji: '🧐', label: 'Thám tử', bg: 'linear-gradient(135deg,#d97706,#78350f)' },
    { id: 'smirk', emoji: '😏', label: 'Bí ẩn', bg: 'linear-gradient(135deg,#9333ea,#4c1d95)' },
    { id: 'star_eyes', emoji: '🤩', label: 'Hào hứng', bg: 'linear-gradient(135deg,#f43f5e,#f59e0b)' },
    { id: 'party_face', emoji: '🥳', label: 'Tiệc tùng', bg: 'linear-gradient(135deg,#22c55e,#06b6d4)' },
    { id: 'cowboy', emoji: '🤠', label: 'Cao bồi', bg: 'linear-gradient(135deg,#ea580c,#9a3412)' },
    { id: 'clown', emoji: '🤡', label: 'Hề hước', bg: 'linear-gradient(135deg,#ef4444,#ec4899)' },
    { id: 'prince', emoji: '🤴', label: 'Hoàng tử', bg: 'linear-gradient(135deg,#eab308,#7c3aed)' },
    { id: 'princess', emoji: '👸', label: 'Công chúa', bg: 'linear-gradient(135deg,#f472b6,#c026d3)' },
    { id: 'detective', emoji: '🕵️', label: 'Đặc vụ', bg: 'linear-gradient(135deg,#334155,#0f172a)' },
    { id: 'ninja', emoji: '🥷', label: 'Ẩn thân', bg: 'linear-gradient(135deg,#1e293b,#7c2d12)' }
  ];

  function getAvatarById(id) {
    return PLAYER_AVATARS.find((a) => a.id === id) || PLAYER_AVATARS[0];
  }

  function getRandomAvatarId(seedIndex) {
    if (typeof seedIndex === 'number' && seedIndex >= 0) {
      return PLAYER_AVATARS[seedIndex % PLAYER_AVATARS.length].id;
    }
    return PLAYER_AVATARS[Math.floor(Math.random() * PLAYER_AVATARS.length)].id;
  }

  const WEREWOLF_ROLES = {
    werewolf: {
      id: 'werewolf',
      name: 'Ma Sói',
      icon: '🐺',
      team: 'werewolf',
      teamName: 'Phe Ma Sói',
      bgImage: 'assets/roles/werewolf.png',
      themeColor: '#ef4444',
      desc: 'Ban đêm thức dậy cùng đồng bọn chọn 1 dân làng để cắn. Ban ngày giả vờ làm dân lương thiện.'
    },
    alpha_wolf: {
      id: 'alpha_wolf',
      name: 'Sói Đầu Đàn',
      icon: '🩸',
      team: 'werewolf',
      teamName: 'Phe Ma Sói',
      bgImage: 'assets/roles/alpha_wolf.png',
      themeColor: '#dc2626',
      desc: 'Thức dậy cùng bầy Sói. Có 1 lần duy nhất trong ván được phép Nguyền biến nạn nhân bị Sói cắn thành Ma Sói mới thay vì giết họ!'
    },
    guard: {
      id: 'guard',
      name: 'Bảo Vệ',
      icon: '🛡️',
      team: 'villager',
      teamName: 'Phe Dân Làng',
      bgImage: 'assets/roles/guard.png',
      themeColor: '#06b6d4',
      desc: 'Mỗi đêm chọn 1 người (kể cả bản thân) để bảo vệ khỏi nanh vuốt Ma Sói. Không được bảo vệ cùng 1 người 2 đêm liên tiếp.'
    },
    seer: {
      id: 'seer',
      name: 'Tiên Tri',
      icon: '🔮',
      team: 'villager',
      teamName: 'Phe Dân Làng',
      bgImage: 'assets/roles/seer.png',
      themeColor: '#a855f7',
      desc: 'Mỗi đêm chọn soi 1 người chơi để biết họ thuộc Phe Ma Sói hay Phe Dân Làng.'
    },
    witch: {
      id: 'witch',
      name: 'Phù Thủy',
      icon: '🧪',
      team: 'villager',
      teamName: 'Phe Dân Làng',
      bgImage: 'assets/roles/witch.png',
      themeColor: '#10b981',
      desc: 'Có 1 Bình Cứu (chữa người bị Sói cắn đêm nay) và 1 Bình Độc (giết 1 người bất kỳ). Mỗi bình chỉ dùng 1 lần cả ván.'
    },
    hunter: {
      id: 'hunter',
      name: 'Thợ Săn',
      icon: '🏹',
      team: 'villager',
      teamName: 'Phe Dân Làng',
      bgImage: 'assets/roles/hunter.png',
      themeColor: '#f59e0b',
      desc: 'Khi bị Sói cắn hoặc treo cổ, bạn hô bắn ở ngoài đời rồi tự bấm chọn người bị bắn trên điện thoại để Bot tiếp tục!'
    },
    cupid: {
      id: 'cupid',
      name: 'Thần Tình Yêu',
      icon: '💘',
      team: 'villager',
      teamName: 'Phe Dân Làng',
      bgImage: 'assets/roles/cupid.png',
      themeColor: '#ec4899',
      desc: 'Đêm đầu tiên ghép đôi 2 người thành Cặp Đôi Tình Nhân. Nếu 1 người chết, người kia chết theo! Nếu 2 người khác phe, họ thành Phe Thứ 3 Cặp Đôi.'
    },
    elder: {
      id: 'elder',
      name: 'Già Làng',
      icon: '🧓',
      team: 'villager',
      teamName: 'Phe Dân Làng',
      bgImage: 'assets/roles/elder.png',
      themeColor: '#d97706',
      desc: 'Có 2 mạng trước nanh vuốt Ma Sói (Sói cắn lần đầu chỉ mất giáp, cắn lần 2 mới chết). Bị độc, Sát Nhân đâm, bắn hoặc treo cổ thì chết ngay.'
    },
    jester: {
      id: 'jester',
      name: 'Thằng Ngố (Kẻ Chán Đời)',
      icon: '🃏',
      team: 'neutral',
      teamName: 'Phe Thứ 3 (Độc Lập)',
      bgImage: 'assets/roles/jester.png',
      themeColor: '#f43f5e',
      desc: 'Bạn thuộc Phe Thứ 3 độc lập! Mục tiêu duy nhất: đánh lừa cả làng biểu quyết TREO CỔ bạn vào ban ngày để thắng ngay lập tức (nếu chết ban đêm thì thua).'
    },
    serial_killer: {
      id: 'serial_killer',
      name: 'Sát Nhân',
      icon: '🗡️',
      team: 'neutral',
      teamName: 'Phe Thứ 3 (Độc Lập)',
      bgImage: 'assets/roles/serial_killer.png',
      themeColor: '#e11d48',
      desc: 'Thuộc Phe Thứ 3 độc lập! Mỗi đêm thức dậy chọn ám sát 1 người. Thắng khi trở thành người sống sót cuối cùng!'
    },
    villager: {
      id: 'villager',
      name: 'Dân Làng',
      icon: '🧑‍🌾',
      team: 'villager',
      teamName: 'Phe Dân Làng',
      bgImage: 'assets/roles/villager.png',
      themeColor: '#eab308',
      desc: 'Không có chức năng đặc biệt ban đêm. Hãy lắng nghe, suy luận ban ngày để tìm ra Ma Sói!'
    }
  };

  const SPY_CARD_THEMES = {
    spy: {
      bgImage: 'assets/roles/spy.png',
      themeColor: '#ef4444'
    },
    mr_white: {
      bgImage: 'assets/roles/spy.png',
      themeColor: '#a855f7'
    },
    civilian: {
      bgImage: 'assets/roles/civilian.png',
      themeColor: '#06b6d4'
    }
  };

  function getRecommendedWerewolfRoles(count) {
    const n = Math.max(5, count || 5);
    const base = {
      werewolf: 1,
      alpha_wolf: 0,
      seer: 1,
      guard: 1,
      witch: 0,
      hunter: 0,
      cupid: 0,
      elder: 0,
      jester: 0,
      serial_killer: 0,
      villager: 2
    };
    if (n === 5) return { ...base };
    if (n === 6) return { ...base, witch: 1, jester: 1, villager: 1 };
    if (n === 7) return { ...base, werewolf: 2, witch: 1, jester: 1, villager: 1 };
    if (n === 8) return { ...base, werewolf: 2, witch: 1, hunter: 1, cupid: 1, jester: 1, villager: 0 };
    if (n === 9) return { ...base, werewolf: 1, alpha_wolf: 1, witch: 1, hunter: 1, cupid: 1, jester: 1, elder: 1, villager: 0 };
    if (n === 10) return { ...base, werewolf: 1, alpha_wolf: 1, witch: 1, hunter: 1, cupid: 1, elder: 1, jester: 1, serial_killer: 1, villager: 0 };
    if (n === 11) return { ...base, werewolf: 2, alpha_wolf: 1, witch: 1, hunter: 1, cupid: 1, elder: 1, jester: 1, serial_killer: 1, villager: 0 };
    const wolves = n >= 13 ? 3 : 2;
    const specialTotal = wolves + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1; // alpha_wolf + seer + guard + witch + hunter + cupid + elder + jester + serial_killer = wolves + 9
    const villagers = Math.max(0, n - specialTotal);
    return {
      werewolf: wolves,
      alpha_wolf: 1,
      seer: 1,
      guard: 1,
      witch: 1,
      hunter: 1,
      cupid: 1,
      elder: 1,
      jester: 1,
      serial_killer: 1,
      villager: villagers
    };
  }

  // 5 Bộ Chủ Đề cho Ai Là Gián Điệp (Undercover) - Từ khóa ngắn gọn (1-3 từ), gần gũi, dễ hiểu
  const UNDERCOVER_DECKS = {
    drama: {
      label: '🔥 Tình Yêu, Drama & Hội Bạn Thân',
      pairs: [
        ['Người yêu cũ', 'Crush', 'Tình cảm', 'Gợi ý: Cảm giác khi vô tình gặp lại ngoài đường'],
        ['Bạn thân', 'Em gái mưa', 'Quan hệ', 'Gợi ý: Mức độ thân thiết dễ làm người yêu ghen'],
        ['Quỹ đen', 'Tiền lì xì', 'Tiền bạc', 'Gợi ý: Cách cất giấu hoặc niềm vui khi mở ra'],
        ['Phong bì cưới', 'Thiệp mời cưới', 'Đám cưới', 'Gợi ý: Thứ trao tay nhau ở sảnh nhà hàng'],
        ['Bùng kèo', 'Đi trễ', 'Hội bạn', 'Gợi ý: Thói quen xấu làm cả đám bạn phát bực'],
        ['Trà xanh', 'Bad boy', 'Tình trường', 'Gợi ý: Kiểu người rất khéo miệng nhưng nguy hiểm'],
        ['Thả thính', 'Tỏ tình', 'Tán tỉnh', 'Gợi ý: Cách phát tín hiệu khi thích một ai đó'],
        ['Đã xem (Seen)', 'Chặn (Block)', 'Nhắn tin', 'Gợi ý: Phản ứng phũ phàng trên mạng xã hội'],
        ['Nhẫn cưới', 'Nhẫn cầu hôn', 'Trang sức', 'Gợi ý: Khoảnh khắc đeo vào ngón tay'],
        ['Tinder', 'Xem mắt', 'Hẹn hò', 'Gợi ý: Cách hai người lạ tìm hiểu nhau lần đầu'],
        ['Ảnh thẻ', 'Ảnh dìm hàng', 'Hình ảnh', 'Gợi ý: Bức ảnh không ai muốn đăng lên mạng'],
        ['Mối tình đầu', 'Tình đơn phương', 'Kỷ niệm', 'Gợi ý: Cảm xúc nhớ mãi dù đã qua lâu'],
        ['Ghen tuông', 'Giận dỗi', 'Tình yêu', 'Gợi ý: Biểu hiện khi người yêu không vừa ý'],
        ['Sao kê', 'Từ thiện', 'Mạng xã hội', 'Gợi ý: Từ khóa nhạy cảm mỗi khi có biến lớn'],
        ['Mẹ chồng', 'Bố vợ', 'Gia đình', 'Gợi ý: Áp lực mỗi lần về ra mắt nhà người yêu'],
        ['Đám cưới', 'Đám hỏi', 'Sự kiện', 'Gợi ý: Nghi lễ, trang phục và bàn tiệc'],
        ['Trốn nợ', 'Đòi nợ', 'Tiền bạc', 'Gợi ý: Thái độ của hai bên khi đến hẹn trả tiền'],
        ['Sếp', 'Đồng nghiệp', 'Công sở', 'Gợi ý: Người ngày nào đi làm cũng phải chạm mặt'],
        ['Tăng ca', 'Trốn việc', 'Đi làm', 'Gợi ý: Cảnh tượng ở văn phòng lúc 6 giờ chiều'],
        ['Lương tháng', 'Thưởng Tết', 'Thu nhập', 'Gợi ý: Khoản tiền mong ngóng nhất khi đi làm'],
        ['Nói xấu', 'Buôn dưa lê', 'Tám chuyện', 'Gợi ý: Chủ đề rôm rả nhất khi tụ tập quán nước'],
        ['Mặt mộc', 'Trang điểm', 'Ngoại hình', 'Gợi ý: Sự khác biệt trước và sau khi ra khỏi nhà'],
        ['Giảm cân', 'Tập thể dục', 'Dáng vóc', 'Gợi ý: Quyết tâm thường chỉ kéo dài được 3 ngày'],
        ['Say rượu', 'Say xe', 'Cảm giác', 'Gợi ý: Trạng thái quay cuồng và chỉ muốn nằm nghỉ'],
        ['Chia tay', 'Ly hôn', 'Tan vỡ', 'Gợi ý: Khi hai người quyết định đường ai nấy đi']
      ]
    },
    food: {
      label: '🍜 Ẩm Thực & Ăn Nhậu Việt Nam',
      pairs: [
        ['Phở bò', 'Bún bò', 'Món nước', 'Gợi ý: Nước dùng, sợi bánh và rau ăn kèm'],
        ['Bún đậu', 'Bún chả', 'Bữa trưa', 'Gợi ý: Mùi nước chấm đặc trưng bay khắp quán'],
        ['Trứng vịt lộn', 'Trứng gà nướng', 'Ăn vặt', 'Gợi ý: Món ăn bình dân kèm rau răm muối tiêu'],
        ['Chân gà', 'Cánh gà', 'Món nhậu', 'Gợi ý: Phần rất thích hợp để gặm khi ngồi lai rai'],
        ['Trà sữa', 'Trà đào', 'Đồ uống', 'Gợi ý: Thức uống chiều lòng hội chị em công sở'],
        ['Cà phê sữa', 'Bạc xỉu', 'Cà phê', 'Gợi ý: Tỉ lệ sữa đặc và vị đắng buổi sáng'],
        ['Bia hơi', 'Rượu ngâm', 'Đồ nhậu', 'Gợi ý: Thứ rót ra ly để anh em cụng 1-2-3 dzô'],
        ['Lẩu Thái', 'Thịt nướng', 'Tụ tập', 'Gợi ý: Món ăn làm quần áo ám mùi sau bữa tiệc'],
        ['Bánh mì', 'Xôi mặn', 'Bữa sáng', 'Gợi ý: Món ăn nhanh gọn cầm tay lúc vội đi làm'],
        ['Cơm tấm', 'Cơm rang', 'Món cơm', 'Gợi ý: Hạt cơm và các món ăn kèm trên đĩa'],
        ['Bánh chưng', 'Bánh tét', 'Ngày Tết', 'Gợi ý: Hình dáng bên ngoài và cách bóc lá'],
        ['Sầu riêng', 'Quả mít', 'Trái cây', 'Gợi ý: Lớp vỏ gai góc và mùi thơm nồng từ xa'],
        ['Cháo lòng', 'Tiết canh', 'Món quán', 'Gợi ý: Món ăn sáng hoặc nhậu rất hợp của các chú'],
        ['Mì tôm', 'Phở gói', 'Đêm khuya', 'Gợi ý: Cứu tinh lúc nửa đêm chỉ cần chế nước sôi'],
        ['Nước mía', 'Trà đá', 'Giải khát', 'Gợi ý: Ly nước vài nghìn đồng mát lạnh vỉa hè'],
        ['Nem chua rán', 'Cá viên chiên', 'Ăn vặt', 'Gợi ý: Món chiên dầu nóng chấm tương ớt'],
        ['Gà rán', 'Vịt quay', 'Món thịt', 'Gợi ý: Lớp da giòn rụm bên ngoài'],
        ['Sinh tố bơ', 'Nước dừa', 'Giải khát', 'Gợi ý: Độ béo ngậy hoặc thanh mát tự nhiên'],
        ['Bánh tráng trộn', 'Bánh tráng nướng', 'Ăn vặt', 'Gợi ý: Món ăn vặt quốc dân cổng trường'],
        ['Tôm hùm', 'Cua biển', 'Hải sản', 'Gợi ý: Lớp vỏ cứng và giá tiền đắt đỏ'],
        ['Ốc luộc', 'Ngao hấp', 'Hải sản', 'Gợi ý: Hương sả ớt thơm lừng ở quán đêm'],
        ['Xoài lắc', 'Cóc dầm', 'Ăn vặt', 'Gợi ý: Vị chua cay mặn ngọt nghĩ tới đã chảy nước miếng'],
        ['Kem ốc quế', 'Sữa chua', 'Tráng miệng', 'Gợi ý: Món mát lạnh ăn sau bữa chính'],
        ['Nước mắm', 'Nước tương', 'Gia vị', 'Gợi ý: Chén chấm không thể thiếu trên mâm cơm'],
        ['Tương ớt', 'Muối ớt chanh', 'Đồ chấm', 'Gợi ý: Vị cay nồng giúp món ăn ngon hơn']
      ]
    },
    trend: {
      label: '🎬 Giải Trí, Công Nghệ & Mạng Xã Hội',
      pairs: [
        ['TikTok', 'Facebook', 'Mạng xã hội', 'Gợi ý: Ứng dụng lướt mỗi tối trước khi đi ngủ'],
        ['Zalo', 'Messenger', 'Nhắn tin', 'Gợi ý: Nơi nhận tin nhắn công việc hoặc nhóm bạn'],
        ['Shopee', 'Lazada', 'Mua sắm', 'Gợi ý: Nơi săn mã giảm giá và chờ shipper gọi'],
        ['Grab', 'Be', 'Đặt xe', 'Gợi ý: Màu áo đồng phục quen thuộc ngoài đường'],
        ['iPhone', 'Samsung', 'Điện thoại', 'Gợi ý: Thương hiệu smartphone ai cũng biết'],
        ['Sạc dự phòng', 'Dây sạc', 'Phụ kiện', 'Gợi ý: Vật cứu mạng khi điện thoại báo pin yếu'],
        ['Tai nghe', 'Loa kéo', 'Âm thanh', 'Gợi ý: Nghe một mình hay mở cho cả xóm cùng nghe'],
        ['Karaoke', 'Quán Bar', 'Giải trí', 'Gợi ý: Nơi có nhạc to và ánh đèn màu buổi tối'],
        ['Rạp chiếu phim', 'Netflix', 'Xem phim', 'Gợi ý: Mua bắp nước ra ngoài hay nằm nhà đắp chăn'],
        ['Phim kinh dị', 'Phim hài', 'Điện ảnh', 'Gợi ý: Làm khán giả hét toáng lên hay cười nghiêng ngả'],
        ['Liên Quân', 'PUBG', 'Game Mobile', 'Gợi ý: Trò chơi điện thoại hay rủ hội bạn lập team'],
        ['Tiến lên', 'Phỏm (Tá lả)', 'Đánh bài', 'Gợi ý: Bộ bài 52 lá ngày Tết tụ tập'],
        ['Livestream', 'Quay Vlog', 'Mạng xã hội', 'Gợi ý: Bật camera nói chuyện với người xem'],
        ['Săn sale', 'Bom hàng', 'Mua online', 'Gợi ý: Niềm vui người mua hoặc nỗi khổ shipper'],
        ['Bói Tarot', 'Xem chỉ tay', 'Tâm linh', 'Gợi ý: Tìm người phán chuyện tình duyên sắp tới'],
        ['Tập Gym', 'Tập Yoga', 'Thể thao', 'Gợi ý: Đổ mồ hôi rèn vóc dáng trong phòng tập'],
        ['Đá bóng', 'Cầu lông', 'Thể thao', 'Gợi ý: Môn thể thao đồng đội phổ biến sau giờ làm'],
        ['Nhạc trẻ', 'Nhạc Bolero', 'Âm nhạc', 'Gợi ý: Giai điệu sôi động hay trữ tình sâu lắng'],
        ['Ca sĩ', 'Diễn viên', 'Nghệ sĩ', 'Gợi ý: Người nổi tiếng xuất hiện trên sân khấu và màn ảnh'],
        ['Hoa hậu', 'Người mẫu', 'Sắc đẹp', 'Gợi ý: Chiều cao nổi bật và bước đi trên sàn diễn'],
        ['Bằng lái xe', 'Căn cước', 'Giấy tờ', 'Gợi ý: Thẻ cứng luôn phải mang theo trong ví'],
        ['Tiền mặt', 'Chuyển khoản', 'Thanh toán', 'Gợi ý: Cách trả tiền khi đi ăn uống cùng bạn bè'],
        ['Wifi', 'Mạng 4G', 'Internet', 'Gợi ý: Thứ cần đầu tiên khi vào quán cà phê hoặc đi xa'],
        ['Mật khẩu', 'Mã OTP', 'Bảo mật', 'Gợi ý: Dãy ký tự bí mật không được đọc cho người lạ'],
        ['Họp online', 'Làm việc tại nhà', 'Công việc', 'Gợi ý: Mở laptop ở nhà nhưng vẫn phải báo cáo sếp']
      ]
    },
    mind: {
      label: '🤪 Tính Cách & Thói Quen Lầy Lội',
      pairs: [
        ['Keo kiệt', 'Tiết kiệm', 'Tiền bạc', 'Gợi ý: Rất ngại rút ví mỗi khi cả nhóm đi ăn'],
        ['Thật thà', 'Vô duyên', 'Giao tiếp', 'Gợi ý: Nói thẳng toẹt sự thật trước mặt mọi người'],
        ['Tự tin', 'Chảnh chọe', 'Thái độ', 'Gợi ý: Cách ngẩng cao đầu khi bước vào đám đông'],
        ['Lười biếng', 'Ham ngủ', 'Thói quen', 'Gợi ý: Chỉ thích nằm dài trên giường cả ngày nghỉ'],
        ['Hay quên', 'Đãng trí', 'Trí nhớ', 'Gợi ý: Cầm chìa khóa trên tay nhưng vẫn đi tìm'],
        ['Sợ ma', 'Sợ gián', 'Nỗi sợ', 'Gợi ý: Thứ khiến người to xác cũng phải hét toáng lên'],
        ['Sợ vợ', 'Chiều vợ', 'Gia đình', 'Gợi ý: Luôn xin phép bà xã trước mỗi cuộc nhậu'],
        ['Mê trai', 'Mê tiền', 'Sở thích', 'Gợi ý: Mắt sáng rực lên ngay khi nhìn thấy'],
        ['Nói nhiều', 'Hóng hớt', 'Tính cách', 'Gợi ý: Không thể ngồi im quá 5 phút trong bàn nước'],
        ['Thảo mai', 'Nịnh hót', 'Giao tiếp', 'Gợi ý: Lời khen ngọt xớt dành cho người đối diện'],
        ['Nóng tính', 'Lì lợm', 'Cảm xúc', 'Gợi ý: Phản ứng căng thẳng khi xảy ra tranh cãi'],
        ['Lãng mạn', 'Sến súa', 'Tình cảm', 'Gợi ý: Tặng hoa nến và nói những lời ngôn tình'],
        ['Ngây thơ', 'Khờ khạo', 'Tính cách', 'Gợi ý: Ai nói đùa gì cũng tin là thật'],
        ['Hào phóng', 'Tiêu hoang', 'Tiền bạc', 'Gợi ý: Sẵn sàng bao cả bàn nhưng cuối tháng ăn mì'],
        ['Độc thân', 'Ế bền vững', 'Tình trạng', 'Gợi ý: Đi ăn cưới luôn phải ngồi mâm một mình'],
        ['Thất tình', 'Đơn phương', 'Tình yêu', 'Gợi ý: Nghe nhạc buồn lúc nửa đêm rồi thở dài'],
        ['Mất ngủ', 'Ngủ nướng', 'Giấc ngủ', 'Gợi ý: Thức tới 3 giờ sáng hoặc ngủ tới trưa'],
        ['Ngáy to', 'Nói mớ', 'Tật xấu', 'Gợi ý: Nỗi ám ảnh của người nằm ngủ cùng phòng'],
        ['Ở bẩn', 'Bừa bộn', 'Sinh hoạt', 'Gợi ý: Quần áo chất đống trên ghế cả tuần chưa dọn'],
        ['Tham ăn', 'Ăn vặt', 'Đồ ăn', 'Gợi ý: Miệng lúc nào cũng nhai nhóp nhép'],
        ['Nói dối', 'Bốc phét', 'Lời nói', 'Gợi ý: Chuyện có một mà kể vống lên thành mười'],
        ['Đổ thừa', 'Lươn lẹo', 'Thái độ', 'Gợi ý: Không bao giờ chịu nhận lỗi về phần mình'],
        ['Mít ướt', 'Nhõng nhẽo', 'Cảm xúc', 'Gợi ý: Động một chút là rơm rớm nước mắt'],
        ['Chung thủy', 'Đa tình', 'Tình yêu', 'Gợi ý: Cách đối xử với người yêu và người khác giới'],
        ['Gia trưởng', 'Khó tính', 'Tính cách', 'Gợi ý: Muốn mọi thứ phải làm theo đúng ý mình']
      ]
    },
    life: {
      label: '🏙️ Đồ Vật & Đời Sống Quen Thuộc',
      pairs: [
        ['Đà Lạt', 'Sa Pa', 'Du lịch', 'Gợi ý: Thành phố sương mù, dốc cao và trời lạnh'],
        ['Vũng Tàu', 'Nha Trang', 'Biển đảo', 'Gợi ý: Tắm biển cuối tuần và ăn hải sản'],
        ['Bệnh viện', 'Tiệm thuốc tây', 'Y tế', 'Gợi ý: Nơi tìm đến khi trong người bị ốm sốt'],
        ['Siêu thị', 'Chợ truyền thống', 'Mua sắm', 'Gợi ý: Đẩy xe chọn đồ hay đứng trả giá từng đồng'],
        ['Chung cư', 'Nhà trọ', 'Chỗ ở', 'Gợi ý: Thang máy, thẻ từ và tiền thuê hàng tháng'],
        ['Xe máy', 'Xe đạp điện', 'Phương tiện', 'Gợi ý: Phương tiện hai bánh luồn lách giờ tan tầm'],
        ['Ô tô', 'Xe buýt', 'Phương tiện', 'Gợi ý: Ngồi máy lạnh không sợ mưa nắng ngoài đường'],
        ['Thang máy', 'Cầu thang bộ', 'Di chuyển', 'Gợi ý: Cách đi lên tầng cao trong tòa nhà'],
        ['Điều hòa', 'Quạt máy', 'Gia dụng', 'Gợi ý: Thứ bật suốt ngày trong mùa hè nắng nóng'],
        ['Chăn bông', 'Gối ôm', 'Phòng ngủ', 'Gợi ý: Vật bất ly thân trên giường mỗi tối'],
        ['Bàn chải', 'Kem đánh răng', 'Vệ sinh', 'Gợi ý: Dùng mỗi sáng thức dậy và tối trước khi ngủ'],
        ['Dầu gội', 'Sữa tắm', 'Phòng tắm', 'Gợi ý: Tạo bọt thơm tho khi đi tắm'],
        ['Kính cận', 'Kính râm', 'Phụ kiện', 'Gợi ý: Đeo lên mắt khi đọc chữ hoặc khi ra nắng'],
        ['Áo mưa', 'Cây dù (Ô)', 'Mùa mưa', 'Gợi ý: Mang theo trong cốp xe phòng khi trời mưa'],
        ['Dép tổ ong', 'Giày thể thao', 'Giày dép', 'Gợi ý: Mang ở nhà cực bền hay mang đi chạy bộ'],
        ['Nồi cơm điện', 'Bếp ga', 'Nhà bếp', 'Gợi ý: Thiết bị nấu nướng chính trong gian bếp'],
        ['Tủ lạnh', 'Máy giặt', 'Gia dụng', 'Gợi ý: Chiếc máy hình hộp lớn đặt ở góc nhà'],
        ['Chổi quét nhà', 'Cây lau nhà', 'Dọn dẹp', 'Gợi ý: Dụng cụ làm sạch sàn nhà mỗi ngày'],
        ['Con chó', 'Con mèo', 'Thú cưng', 'Gợi ý: Thú cưng quấn chủ hay thích nằm phơi nắng'],
        ['Con muỗi', 'Con gián', 'Côn trùng', 'Gợi ý: Kẻ thù đáng ghét bay vo ve trong phòng ngủ'],
        ['Mặt trời', 'Mặt trăng', 'Bầu trời', 'Gợi ý: Xuất hiện trên cao vào ban ngày hay ban đêm'],
        ['Cúp điện', 'Mất nước', 'Sự cố', 'Gợi ý: Nỗi ám ảnh kinh hoàng vào ngày hè nóng bức'],
        ['Kẹt xe', 'Ngập nước', 'Đường phố', 'Gợi ý: Cảnh tượng giờ tan tầm mỗi khi trời mưa lớn'],
        ['Đám giỗ', 'Tất niên', 'Tiệc tùng', 'Gợi ý: Đại gia đình họ hàng tụ họp ăn uống'],
        ['Đêm Giao Thừa', 'Mùng Một Tết', 'Lễ Tết', 'Gợi ý: Xem pháo hoa hay đi chúc Tết nhận lì xì']
      ]
    }
  };

  // Chế độ Điệp Viên Hỏi Xoáy (Câu Hỏi Lệch Pha) — Câu hỏi ngắn gọn, đời thường, cực hài
  const TWIST_QUESTION_PAIRS = [
    ['Nếu trúng số 10 tỷ, bạn mua gì đầu tiên?', 'Nếu trong ví còn đúng 20 nghìn, bạn mua gì?', 'Tiền bạc'],
    ['Món nào bạn ăn cả tuần không ngán?', 'Món nào bạn ăn một lần là tởn tới già?', 'Đồ ăn'],
    ['Bao nhiêu tuổi kết hôn là đẹp nhất?', 'Năm bao nhiêu tuổi bạn nghịch dại nhất?', 'Tuổi tác'],
    ['Nếu được tàng hình 1 tiếng, bạn đi đâu?', 'Nơi nào bạn ngại đến nhất mỗi tuần?', 'Địa điểm'],
    ['Gặp lại người yêu cũ, bạn sẽ nói câu gì?', 'Có người hỏi vay tiền, bạn nói gì để từ chối?', 'Câu nói'],
    ['Ai trong bàn này giữ bí mật tốt nhất?', 'Ai trong bàn này dễ bị lừa tình nhất?', 'Hội bạn'],
    ['Cuối tuần bạn thường ngủ nướng mấy tiếng?', 'Mùa lạnh bạn có thể nhịn tắm mấy ngày?', 'Thói quen'],
    ['Đi hoang đảo, bạn rủ ai trong bàn này đi cùng?', 'Kẹt thang máy, bạn sợ ở chung với ai nhất bàn này?', 'Chốt kèo'],
    ['Sinh nhật bạn thích được tặng quà gì nhất?', 'Món đồ vô dụng nhất bạn từng mua là gì?', 'Đồ vật'],
    ['Khi tức giận bạn hay làm gì?', 'Mới ngủ dậy việc đầu tiên bạn làm là gì?', 'Hành động'],
    ['Biệt danh hồi nhỏ của bạn là gì?', 'Món đồ nào ở nhà bạn muốn vứt đi nhất?', 'Tên gọi'],
    ['Mùi hương nào bạn thích ngửi nhất?', 'Mùi gì khiến bạn muốn bịt mũi chạy ngay?', 'Mùi hương'],
    ['Điểm nào ở người khác thu hút bạn đầu tiên?', 'Chỗ nào trên người bạn hay đau mỏi nhất?', 'Cơ thể'],
    ['Con vật nào giống tính cách bạn nhất?', 'Con vật nào bạn sợ nhìn thấy nhất?', 'Động vật'],
    ['Đi hát Karaoke bạn hay chọn bài tủ nào?', 'Tiếng động nào làm bạn khó chịu nhất?', 'Âm thanh'],
    ['Bạn dám cho bạn thân vay tối đa bao nhiêu tiền?', 'Bữa ăn đắt nhất bạn từng trả là bao nhiêu?', 'Con số'],
    ['Tiêu chuẩn chọn người yêu số 1 của bạn là gì?', 'Tật xấu khó bỏ nhất của bạn là gì?', 'Tính cách'],
    ['1 giờ sáng chưa ngủ bạn thường làm gì?', 'Buổi sáng việc gì làm bạn tốn thời gian nhất?', 'Giờ giấc'],
    ['Một buổi nhậu bạn uống được mấy lon bia?', 'Mỗi ngày bạn uống mấy ly cà phê / trà sữa?', 'Đồ uống'],
    ['Ai nhắn tin với bạn nhiều nhất tuần qua?', 'Ai trong nhóm hay xem tin nhắn mà không trả lời?', 'Tin nhắn'],
    ['Đi du lịch nhóm bạn hay nhận nhiệm vụ gì?', 'Dọn nhà đón Tết bạn hay trốn việc gì nhất?', 'Vai trò'],
    ['Kiểu tóc nào hợp với bạn nhất?', 'Kiểu trang phục nào bạn không bao giờ dám mặc?', 'Ngoại hình'],
    ['Tương lai bạn muốn có mấy đứa con?', 'Từ trước tới giờ bạn làm hỏng mấy cái điện thoại rồi?', 'Số lượng'],
    ['Ra khỏi nhà bạn không thể quên mang thứ gì?', 'Món đồ nào ở nhà bạn hay làm thất lạc nhất?', 'Vật dụng'],
    ['Lần gần nhất bạn khóc là vì chuyện gì?', 'Lần gần nhất bạn cười đau bụng là vì chuyện gì?', 'Cảm xúc'],
    ['Thành phố nào ở Việt Nam bạn thích đi nhất?', 'Đoạn đường nào bạn sợ kẹt xe nhất?', 'Đường phố'],
    ['Nếu được đổi nghề, bạn muốn làm nghề gì?', 'Nghề gì bạn thấy vất vả nhất?', 'Nghề nghiệp'],
    ['Món quà đắt nhất bạn từng tặng người khác là gì?', 'Món đồ rẻ nhất bạn mới mua trên Shopee là gì?', 'Mua sắm'],
    ['Ai trong bàn này nấu ăn ngon nhất?', 'Ai trong bàn này có nguy cơ làm cháy bếp cao nhất?', 'Bếp núc'],
    ['Thứ mấy trong tuần bạn thích nhất?', 'Ngày nào trong tuần bạn hay tiêu tiền nhiều nhất?', 'Ngày tháng']
  ];

  // 30 Địa điểm Spyfall (Thay thế địa điểm xa lạ bằng địa điểm Việt Nam gần gũi)
  const SPYFALL_LOCATIONS = [
    { name: 'Bệnh viện', roles: ['Bác sĩ', 'Y tá trực đêm', 'Bệnh nhân', 'Dược sĩ bán thuốc', 'Bảo vệ', 'Người nhà chăm bệnh', 'Thực tập sinh', 'Tài xế xe cấp cứu'] },
    { name: 'Máy bay', roles: ['Phi công', 'Tiếp viên hàng không', 'Khách hạng thương gia', 'Khách say máy bay', 'An ninh sân bay', 'Khách du lịch', 'Em bé khóc nhè', 'Thợ máy sân bay'] },
    { name: 'Trường học', roles: ['Hiệu trưởng', 'Giáo viên chủ nhiệm', 'Học sinh cá biệt', 'Lớp trưởng', 'Cô lao công', 'Chú bảo vệ', 'Cô bán căng tin', 'Phụ huynh'] },
    { name: 'Quán cà phê', roles: ['Pha chế (Barista)', 'Thu ngân', 'Người ngồi chạy deadline', 'Cặp đôi hẹn hò', 'Phục vụ bàn', 'Chủ quán', 'Sinh viên học bài', 'Shipper lấy nước'] },
    { name: 'Rạp chiếu phim', roles: ['Nhân viên bán bắp nước', 'Người soát vé', 'Cặp đôi ghế cuối', 'Người hay kể trước phim', 'Kỹ thuật phòng chiếu', 'Khách xem một mình', 'Quản lý rạp', 'Fan phim kinh dị'] },
    { name: 'Siêu thị', roles: ['Thu ngân', 'Nhân viên xếp hàng', 'Bảo vệ giữ đồ', 'Bà nội trợ săn sale', 'Người phát đồ ăn thử', 'Quản lý siêu thị', 'Khách mua mì gói', 'Thợ làm bánh'] },
    { name: 'Đám cưới', roles: ['Cô dâu', 'Chú rể', 'MC đám cưới', 'Thợ chụp ảnh', 'Bạn thân cô dâu', 'Phục vụ bàn tiệc', 'Khách mừng phong bì', 'Người yêu cũ đi dự'] },
    { name: 'Sở thú', roles: ['Người nuôi thú', 'Bác sĩ thú y', 'Hướng dẫn viên', 'Khách tham quan', 'Người bán bóng bay', 'Thợ chụp ảnh', 'Bảo vệ cổng', 'Em nhỏ đi xem thú'] },
    { name: 'Bãi biển', roles: ['Cứu hộ bờ biển', 'Người bán dừa tươi', 'Khách tắm biển', 'Người lướt sóng', 'Thợ chụp ảnh dạo', 'Người cho thuê phao', 'Đầu bếp hải sản', 'Trẻ em xây lâu đài cát'] },
    { name: 'Ngân hàng', roles: ['Giao dịch viên', 'Giám đốc chi nhánh', 'Bảo vệ mở cửa', 'Khách vay tiền', 'Nhân viên tư vấn thẻ', 'Kế toán', 'Người đi rút tiền', 'Thợ sửa cây ATM'] },
    { name: 'Đồn công an', roles: ['Công an hình sự', 'Trực ban tiếp dân', 'Cảnh sát giao thông', 'Người báo mất đồ', 'Luật sư', 'Điều tra viên', 'Phóng viên', ' Công an phường'] },
    { name: 'Tàu hỏa', roles: ['Lái tàu', 'Nhân viên soát vé', 'Người đẩy xe đồ ăn', 'Khách nằm giường tầng', 'Khách đi phượt', 'Sinh viên về quê', 'Thợ máy tàu', 'Người bán hàng ở ga'] },
    { name: 'Khách sạn', roles: ['Lễ tân', 'Nhân viên xách hành lý', 'Đầu bếp', 'Cô dọn phòng', 'Khách VIP', 'Quản lý khách sạn', 'Bảo vệ sảnh', 'Pha chế quầy bar'] },
    { name: 'Phòng tập Gym', roles: ['Huấn luyện viên (PT)', 'Lễ tân quầy thẻ', 'Người mới tập buổi đầu', 'Người tập tạ nặng', 'Nhân viên lau dọn', 'Khách đứng chụp ảnh gương', 'Chủ phòng tập', 'Người chạy máy chạy bộ'] },
    { name: 'Quán nhậu vỉa hè', roles: ['Chủ quán nhậu', 'Nhân viên chạy bàn', 'Khách say xỉn', 'Người bán vé số', 'Đầu bếp nướng mồi', 'Ca sĩ kẹo kéo', 'Người chỉ uống nước ngọt', 'Bảo vệ dắt xe'] },
    { name: 'Tiệm Net (Quán Game)', roles: ['Chủ quán coi máy', 'Game thủ cày đêm', 'Người nấu mì tôm', 'Học sinh trốn học', 'Người đứng xem ké', 'Đội trưởng đi đánh giải', 'Thợ sửa máy tính', 'Phụ huynh đi tìm con'] },
    { name: 'Công viên giải trí', roles: ['Người bấm máy tàu lượn', 'Người mặc đồ gấu bông', 'Người bán kem', 'Khách sợ độ cao', 'Nhân viên soát vé', 'Nhân viên y tế', 'Bố mẹ dắt con', 'Thợ chụp ảnh'] },
    { name: 'Đoàn làm phim', roles: ['Đạo diễn', 'Diễn viên chính', 'Diễn viên đóng thế', 'Thợ quay phim', 'Thợ trang điểm', 'Người cầm micro', 'Biên kịch', 'Trợ lý trường quay'] },
    { name: 'Quán lẩu nướng', roles: ['Đầu bếp thái thịt', 'Nhân viên thay vỉ nướng', 'Thu ngân', 'Khách ăn buffet', 'Quản lý quán', 'Người rửa bát', 'Shipper chờ đơn', 'Tiktoker review đồ ăn'] },
    { name: 'Tiệm cắt tóc', roles: ['Thợ cắt tóc chính', 'Nhân viên gội đầu', 'Lễ tân', 'Khách uốn nhuộm', 'Thợ phụ sấy tóc', 'Học việc quét tóc', 'Khách ngồi chờ tới lượt', 'Chủ tiệm'] },
    { name: 'Sân bóng đá', roles: ['Tiền đạo', 'Thủ môn', 'Trọng tài', 'Huấn luyện viên', 'Cổ động viên', 'Bình luận viên', 'Nhân viên y tế', 'Người bán nước dạo'] },
    { name: 'Thư viện', roles: ['Thủ thư', 'Sinh viên ôn thi', 'Người đọc báo', 'Người nằm ngủ gật', 'Bảo vệ', 'Nhân viên xếp sách', 'Học sinh mượn truyện', 'Thợ sửa máy tính'] },
    { name: 'Quán Karaoke', roles: ['Nhân viên chỉnh nhạc', 'Phục vụ bê bia trái cây', 'Người ôm mic hát suốt', 'Thu ngân', 'Bảo vệ giữ xe', 'Quản lý quán', 'Người chỉ ngồi bấm bài', 'Khách vào nhầm phòng'] },
    { name: 'Du thuyền', roles: ['Thuyền trưởng', 'Ca sĩ hát live', 'Đầu bếp', 'Nhân viên cứu hộ', 'Khách bị say sóng', 'Hướng dẫn viên', 'Thợ chụp ảnh', 'Bartender pha rượu'] },
    { name: 'Công trường xây dựng', roles: ['Kỹ sư giám sát', 'Kiến trúc sư', 'Thợ lái cần cẩu', 'Thợ xây (Thợ hồ)', 'Thợ điện', 'Bảo vệ công trường', 'Chủ nhà đi kiểm tra', 'Người chở vật liệu'] },
    { name: 'Chợ đêm', roles: ['Chủ sạp quần áo', 'Người bán cá viên chiên', 'Khách mặc cả giá', 'Bảo vệ chợ', 'Người hát rong', 'Người bán ốp lưng', 'Shipper giao hàng', 'Khách đi dạo ăn vặt'] },
    { name: 'Rạp xiếc', roles: ['Diễn viên nhào lộn', 'Chú hề', 'Người dạy thú', 'Nhà ảo thuật', 'MC sân khấu', 'Người bán vé', 'Khán giả nhỏ tuổi', 'Thợ chỉnh đèn'] },
    { name: 'Khu cắm trại', roles: ['Trưởng nhóm phượt', 'Người nhóm lửa nướng thịt', 'Người đánh đàn guitar', 'Hướng dẫn viên', 'Người chụp ảnh', 'Người sợ côn trùng', 'Người dựng lều', 'Người pha cà phê sáng'] },
    { name: 'Tiệm sửa xe', roles: ['Thợ sửa máy', 'Thợ vá xe', 'Khách bị thủng lốp', 'Thu ngân', 'Thợ học việc', 'Người rửa xe bọt tuyết', 'Người bán phụ tùng', 'Tài xế xe ôm'] },
    { name: 'Văn phòng công ty', roles: ['Giám đốc (Sếp)', 'Nhân sự (HR)', 'Thực tập sinh', 'Nhân viên IT', 'Kế toán', 'Lễ tân', 'Nhân viên sale', 'Bảo vệ tòa nhà'] }
  ];

  // Bộ 15 câu hỏi thẩm vấn mẫu cho Spyfall
  const SPYFALL_QUESTIONS = [
    'Bạn có hay đến chỗ này vào ban đêm không?',
    'Đến đây thường phải mặc trang phục như thế nào?',
    'Mùi đặc trưng nhất ở nơi này là mùi gì?',
    'Hôm nay bạn đi một mình hay đi cùng ai tới đây?',
    'Ở đây thứ gì đắt tiền nhất?',
    'Trẻ con dưới 5 tuổi tới đây có hợp không?',
    'Bạn có cần mua vé hay xếp hàng trước khi vào đây không?',
    'Âm thanh bạn nghe thấy rõ nhất ở xung quanh là gì?',
    'Nếu bị mất đồ ở đây, bạn sẽ chạy đi tìm ai đầu tiên?',
    'Bạn thường ở lại chỗ này khoảng bao lâu?',
    'Trong túi bạn lúc này thường mang theo món đồ gì liên quan tới nơi đây?',
    'Ở đây có quy định cấm chụp ảnh hay cấm nói to không?',
    'Bạn thích nhất góc nào tại nơi này?',
    'Công việc của bạn ở đây có vất vả về thể lực không?',
    'Nếu trời đổ mưa to thì nơi này có bị ảnh hưởng gì không?'
  ];

  // Thử thách / Gợi ý dẫn chuyện của Bot cho từng vòng chơi Gián Điệp
  const ROUND_SPARKS = [
    'Mô tả bằng 1 câu ngắn gọn dựa trên trải nghiệm cá nhân của bạn!',
    'Không dùng từ đồng nghĩa trực tiếp — hãy nói về cảm xúc hoặc tình huống khi gặp nó!',
    'Vòng xoáy nhanh: Mỗi người chỉ được nói đúng 3 đến 5 từ để mô tả!',
    'Hãy đặt ra một giả định: "Nếu thiếu thứ này thì..." hoặc "Lần gần nhất bạn thấy..."!',
    'Mô tả gián tiếp: Nói thứ gì thường đi kèm hoặc đối lập với từ khóa của bạn!'
  ];

  function getDeckPairs(deckKey) {
    if (!deckKey || deckKey === 'all') {
      return Object.values(UNDERCOVER_DECKS).flatMap((d) => d.pairs);
    }
    return UNDERCOVER_DECKS[deckKey]?.pairs || UNDERCOVER_DECKS.drama.pairs;
  }

  return {
    APP_VERSION,
    PLAYER_AVATARS,
    getAvatarById,
    getRandomAvatarId,
    WEREWOLF_ROLES,
    SPY_CARD_THEMES,
    getRecommendedWerewolfRoles,
    UNDERCOVER_DECKS,
    getDeckPairs,
    TWIST_QUESTION_PAIRS,
    SPYFALL_LOCATIONS,
    SPYFALL_QUESTIONS,
    ROUND_SPARKS
  };
})();
