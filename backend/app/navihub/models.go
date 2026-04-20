package navihub

// passwordResetsTable 与 Laravel 等框架的 password_resets 区分，避免同名异构表。
const passwordResetsTable = "navihub_password_resets"

// 用户主键自增；其余实体 id 仍为字符串。引用 users 的列使用 bigint。

type User struct {
	ID       uint64 `gorm:"primaryKey;autoIncrement;column:id;type:bigint unsigned"`
	Name     string `gorm:"column:name;type:varchar(255);not null"`
	Email    string `gorm:"column:email;type:varchar(255);not null;uniqueIndex:uq_users_email"`
	Avatar   string `gorm:"column:avatar;type:text"`
	Password string `gorm:"column:password;type:varchar(512)"`
}

func (User) TableName() string { return "users" }

type Team struct {
	ID          string `gorm:"primaryKey;column:id;type:varchar(64)"`
	Name        string `gorm:"column:name;type:varchar(255);not null"`
	Description string `gorm:"column:description;type:text"`
	OwnerID     uint64 `gorm:"column:ownerId;type:bigint unsigned;not null;index"`
}

func (Team) TableName() string { return "teams" }

type TeamMember struct {
	ID     string `gorm:"primaryKey;column:id;type:varchar(64)"`
	TeamID string `gorm:"column:teamId;type:varchar(64);not null;index"`
	UserID uint64 `gorm:"column:userId;type:bigint unsigned;not null;index"`
	Role   string `gorm:"column:role;type:varchar(32);not null"`
}

func (TeamMember) TableName() string { return "team_members" }

type Project struct {
	ID          string `gorm:"primaryKey;column:id;type:varchar(64)"`
	TeamID      string `gorm:"column:teamId;type:varchar(64);not null"`
	Name        string `gorm:"column:name;type:varchar(255);not null"`
	Description string `gorm:"column:description;type:text"`
}

func (Project) TableName() string { return "projects" }

type Group struct {
	ID        string  `gorm:"primaryKey;column:id;type:varchar(64)"`
	Name      string  `gorm:"column:name;type:varchar(255);not null"`
	UserID    *uint64 `gorm:"column:userId;type:bigint unsigned"`
	TeamID    *string `gorm:"column:teamId;type:varchar(64)"`
	ProjectID *string `gorm:"column:projectId;type:varchar(64)"`
	OrderNum  int     `gorm:"column:order_num;default:0"`
}

func (Group) TableName() string { return "groups" }

type Link struct {
	ID          string  `gorm:"primaryKey;column:id;type:varchar(64)"`
	Title       string  `gorm:"column:title;type:varchar(512);not null"`
	URL         string  `gorm:"column:url;type:text;not null"`
	Icon        *string `gorm:"column:icon;type:text"`
	Clicks      int     `gorm:"column:clicks;default:0"`
	IsPublic    int     `gorm:"column:isPublic;default:0"`
	TeamID      *string `gorm:"column:teamId;type:varchar(64)"`
	ProjectID   *string `gorm:"column:projectId;type:varchar(64)"`
	UserID      *uint64 `gorm:"column:userId;type:bigint unsigned;index"`
	GroupID     *string `gorm:"column:groupId;type:varchar(64)"`
	DisplaySize *string `gorm:"column:displaySize;type:varchar(32)"`
	OrderNum    int     `gorm:"column:order_num;default:100"`
	BgColor     *string `gorm:"column:bgColor;type:varchar(32)"`
}

func (Link) TableName() string { return "links" }

type Widget struct {
	ID       string `gorm:"primaryKey;column:id;type:varchar(64)"`
	UserID   uint64 `gorm:"column:userId;type:bigint unsigned;not null;index"`
	Type     string `gorm:"column:type;type:varchar(64);not null"`
	Visible  int    `gorm:"column:visible;default:1"`
	OrderNum int    `gorm:"column:order_num;default:0"`
	Settings string `gorm:"column:settings;type:text"`
}

func (Widget) TableName() string { return "widgets" }

type WikiNode struct {
	ID        string  `gorm:"primaryKey;column:id;type:varchar(64)"`
	TeamID    string  `gorm:"column:teamId;type:varchar(64);not null"`
	ParentID  *string `gorm:"column:parentId;type:varchar(64)"`
	Type      string  `gorm:"column:type;type:varchar(32);not null"`
	Title     string  `gorm:"column:title;type:varchar(512);not null"`
	Content   *string `gorm:"column:content;type:mediumtext"`
	UpdatedAt string  `gorm:"column:updatedAt;type:varchar(64);not null"`
}

func (WikiNode) TableName() string { return "wiki_nodes" }

type PasswordReset struct {
	Token     string  `gorm:"primaryKey;column:token;type:varchar(128)"`
	UserID    uint64  `gorm:"column:userId;type:bigint unsigned;not null;index"`
	ExpiresAt string  `gorm:"column:expiresAt;type:varchar(64);not null"`
	UsedAt    *string `gorm:"column:usedAt;type:varchar(64)"`
}

func (PasswordReset) TableName() string { return passwordResetsTable }
