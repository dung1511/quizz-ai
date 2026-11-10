import { QuizSet, SampleDocument, QuizAttempt, Question } from '../types';

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: 'doc-csdl',
    title: 'Giáo trình Cơ sở dữ liệu & Ngôn ngữ SQL',
    category: 'Công nghệ thông tin',
    description: 'Bao gồm tổng quan CSDL quan hệ, cú pháp câu lệnh truy vấn SQL (SELECT, JOIN, GROUP BY) và lý thuyết chuẩn hóa dữ liệu (1NF, 2NF, 3NF, BCNF).',
    fileName: 'CSDL.pdf',
    fileSize: '3.6 MB',
    pageCount: 85,
    content: `GIÁO TRÌNH CƠ SỞ DỮ LIỆU QUAN HỆ VÀ NGÔN NGỮ TRUY VẤN SQL
CHƯƠNG 1: TỔNG QUAN VỀ HỆ CƠ SỞ DỮ LIỆU
1.1. Các khái niệm cơ bản về CSDL và Hệ quản trị CSDL (DBMS):
Cơ sở dữ liệu (Database) là một tập hợp các dữ liệu có liên quan logic với nhau, được lưu trữ trên các thiết bị nhớ thứ cấp một cách có cấu trúc nhằm phục vụ nhu cầu khai thác thông tin của nhiều người dùng và ứng dụng. Hệ quản trị CSDL (DBMS) là phần mềm cung cấp môi trường thuận tiện và hiệu quả để định nghĩa, tạo lập, lưu trữ, thao tác và kiểm soát truy cập dữ liệu.
1.2. Tính độc lập dữ liệu và mô hình 3 mức kiến trúc ANSI/SPARC:
Mô hình kiến trúc ANSI/SPARC chia hệ CSDL thành 3 mức trừu tượng: Mức ngoài (Khung nhìn người dùng), Mức quan niệm (Lược đồ dữ liệu logic toàn cục), Mức trong (Cấu trúc lưu trữ vật lý trên đĩa).

CHƯƠNG 2: MÔ HÌNH DỮ LIỆU QUAN HỆ VÀ CÁC RÀNG BUỘC TOÀN VẸN
2.1. Quan hệ, thuộc tính và bộ giá trị:
Trong mô hình quan hệ của E.F. Codd, một quan hệ (bảng) là một tập hợp hữu hạn các bộ giá trị (hàng), mỗi bộ gồm tập các giá trị tương ứng với các thuộc tính (cột).
2.2. Khóa chính, khóa ngoại và tính toàn vẹn tham chiếu:
Khóa chính (Primary Key) là một tập thuộc tính tối thiểu xác định duy nhất mỗi bộ trong quan hệ, không được phép chứa giá trị NULL (ràng buộc toàn vẹn thực thể). Khóa ngoại (Foreign Key) là tập thuộc tính trong một quan hệ tham chiếu đến khóa chính của quan hệ khác, đảm bảo tính toàn vẹn tham chiếu.

CHƯƠNG 3: NGÔN NGỮ TRUY VẤN CÓ CẤU TRÚC SQL
3.1. Phân loại câu lệnh SQL: DDL, DML, DCL và DQL:
SQL bao gồm các nhóm lệnh: DDL (Data Definition Language: CREATE, ALTER, DROP), DML (Data Manipulation Language: INSERT, UPDATE, DELETE), DQL (Data Query Language: SELECT).
3.2. Cú pháp và kỹ thuật truy vấn dữ liệu với câu lệnh SELECT:
Cú pháp cơ bản của câu lệnh SELECT gồm các mệnh đề:
SELECT [DISTINCT] danh_sách_thuộc_tính
FROM tên_bảng
WHERE điều_kiện_lọc
GROUP BY danh_sách_nhóm
HAVING điều_kiện_nhóm
ORDER BY thuộc_tính_sắp_xếp [ASC|DESC];
Mệnh đề FROM là bắt buộc để xác định bảng nguồn chứa dữ liệu cần truy xuất. Mệnh đề WHERE lọc từng dòng bản ghi trước khi gom nhóm, trong khi HAVING lọc dữ liệu sau khi đã thực hiện phép gom nhóm và tính toán hàm tổng hợp (COUNT, SUM, AVG, MIN, MAX).
3.3. Các phép kết nối bảng (JOIN):
INNER JOIN trả về các bản ghi có giá trị khớp ở cả hai bảng. LEFT OUTER JOIN trả về toàn bộ dữ liệu ở bảng bên trái kèm dữ liệu khớp ở bảng bên phải; nếu không khớp, các thuộc tính bảng phải sẽ nhận giá trị NULL.

CHƯƠNG 4: THIẾT KẾ CƠ SỞ DỮ LIỆU VÀ LÝ THUYẾT CHUẨN HÓA
4.1. Khái niệm phụ thuộc hàm (Functional Dependency):
Cho lược đồ quan hệ R(U), X và Y là các tập con của U. Y phụ thuộc hàm vào X (ký hiệu X -> Y) nếu với mọi cặp bộ t1, t2 trong r(R), nếu t1[X] = t2[X] thì t1[Y] = t2[Y].
4.2. Quá trình chuẩn hóa dữ liệu (Normalization) từ 1NF đến BCNF:
Chuẩn hóa dữ liệu là quá trình phân rã có hệ thống các quan hệ nhằm loại bỏ sự dư thừa dữ liệu (redundancy) và ngăn ngừa các dị thường dữ liệu (anomalies) trong quá trình thêm (insert), xóa (delete) và sửa (update).
- Dạng chuẩn 1 (1NF): Mọi thuộc tính đều chứa các giá trị nguyên tố (nguyên tử), không chứa thuộc tính đa trị hoặc thuộc tính phức hợp.
- Dạng chuẩn 2 (2NF): Đạt 1NF và mọi thuộc tính không khóa đều phụ thuộc hàm đầy đủ vào khóa chính (loại bỏ phụ thuộc từng phần vào khóa phức hợp).
- Dạng chuẩn 3 (3NF): Đạt 2NF và không có thuộc tính không khóa nào phụ thuộc bắc cầu vào khóa chính.
- Dạng chuẩn Boyce-Codd (BCNF): Với mọi phụ thuộc hàm không tầm thường X -> Y, X phải là một siêu khóa.`,
    chapters: [
      {
        id: 'chap-csdl-1',
        chapterNumber: 1,
        title: 'Chương 1 – Tổng quan về Hệ cơ sở dữ liệu',
        pageStart: 1,
        pageEnd: 15,
        sections: [
          { id: 'sec-csdl-1.1', chapterId: 'chap-csdl-1', sectionNumber: '1.1', title: 'Khái niệm CSDL & DBMS', page: 3 },
          { id: 'sec-csdl-1.2', chapterId: 'chap-csdl-1', sectionNumber: '1.2', title: 'Kiến trúc 3 mức ANSI/SPARC', page: 8 },
        ],
      },
      {
        id: 'chap-csdl-2',
        chapterNumber: 2,
        title: 'Chương 2 – Mô hình quan hệ và Ràng buộc toàn vẹn',
        pageStart: 16,
        pageEnd: 35,
        sections: [
          { id: 'sec-csdl-2.1', chapterId: 'chap-csdl-2', sectionNumber: '2.1', title: 'Khái niệm quan hệ và thuộc tính', page: 18 },
          { id: 'sec-csdl-2.2', chapterId: 'chap-csdl-2', sectionNumber: '2.2', title: 'Khóa chính và Toàn vẹn tham chiếu', page: 24 },
        ],
      },
      {
        id: 'chap-csdl-3',
        chapterNumber: 3,
        title: 'Chương 3 – Ngôn ngữ truy vấn có cấu trúc SQL',
        pageStart: 36,
        pageEnd: 60,
        sections: [
          { id: 'sec-csdl-3.1', chapterId: 'chap-csdl-3', sectionNumber: '3.1', title: 'Phân loại câu lệnh SQL', page: 38 },
          { id: 'sec-csdl-3.2', chapterId: 'chap-csdl-3', sectionNumber: '3.2', title: 'Cú pháp câu lệnh SELECT', page: 42 },
          { id: 'sec-csdl-3.3', chapterId: 'chap-csdl-3', sectionNumber: '3.3', title: 'Các phép kết nối JOIN', page: 50 },
        ],
      },
      {
        id: 'chap-csdl-4',
        chapterNumber: 4,
        title: 'Chương 4 – Lý thuyết chuẩn hóa dữ liệu',
        pageStart: 61,
        pageEnd: 85,
        sections: [
          { id: 'sec-csdl-4.1', chapterId: 'chap-csdl-4', sectionNumber: '4.1', title: 'Phụ thuộc hàm (Functional Dependency)', page: 63 },
          { id: 'sec-csdl-4.2', chapterId: 'chap-csdl-4', sectionNumber: '4.2', title: 'Chuẩn hóa Normalization (1NF - BCNF)', page: 52 },
        ],
      },
    ],
    knowledgeUnits: [
      {
        id: 'ku-csdl-dbms',
        documentId: 'doc-csdl',
        chapter: 'Chương 1 – Tổng quan về Hệ cơ sở dữ liệu',
        section: '1.1 – Khái niệm CSDL & DBMS',
        name: 'Hệ quản trị CSDL (DBMS)',
        type: 'definition',
        description: 'Phần mềm cung cấp môi trường thuận tiện và hiệu quả để định nghĩa, tạo lập, lưu trữ, thao tác và kiểm soát truy cập dữ liệu.',
        importance: 'core',
        sourceChunkId: 'chunk-csdl-1.1',
        sourceText: 'Cơ sở dữ liệu (Database) là một tập hợp các dữ liệu có liên quan logic với nhau, được lưu trữ có cấu trúc. Hệ quản trị CSDL (DBMS) là phần mềm cung cấp môi trường thuận tiện và hiệu quả để định nghĩa, tạo lập, lưu trữ, thao tác và kiểm soát truy cập dữ liệu.',
        pageNumber: 3,
      },
      {
        id: 'ku-csdl-ansisparc',
        documentId: 'doc-csdl',
        chapter: 'Chương 1 – Tổng quan về Hệ cơ sở dữ liệu',
        section: '1.2 – Kiến trúc 3 mức ANSI/SPARC',
        name: 'Kiến trúc 3 mức ANSI/SPARC',
        type: 'principle',
        description: 'Mô hình kiến trúc chia hệ CSDL thành 3 mức trừu tượng: Mức ngoài (Khung nhìn), Mức quan niệm (Lược đồ logic), Mức trong (Lưu trữ vật lý).',
        importance: 'core',
        sourceChunkId: 'chunk-csdl-1.2',
        sourceText: 'Mô hình kiến trúc ANSI/SPARC chia hệ CSDL thành 3 mức trừu tượng: Mức ngoài (Khung nhìn người dùng), Mức quan niệm (Lược đồ dữ liệu logic toàn cục), Mức trong (Cấu trúc lưu trữ vật lý trên đĩa).',
        pageNumber: 8,
      },
      {
        id: 'ku-csdl-pk',
        documentId: 'doc-csdl',
        chapter: 'Chương 2 – Mô hình quan hệ và Ràng buộc toàn vẹn',
        section: '2.2 – Khóa chính và Toàn vẹn tham chiếu',
        name: 'Khóa chính (Primary Key)',
        type: 'definition',
        description: 'Tập thuộc tính tối thiểu xác định duy nhất mỗi bộ trong quan hệ, tuân thủ ràng buộc toàn vẹn thực thể (không được chứa giá trị NULL).',
        importance: 'core',
        sourceChunkId: 'chunk-csdl-2.2',
        sourceText: 'Khóa chính là tập thuộc tính tối thiểu xác định duy nhất mỗi bộ trong một quan hệ, không bao giờ được phép chứa giá trị NULL nhằm đảm bảo toàn vẹn thực thể.',
        pageNumber: 24,
      },
      {
        id: 'ku-csdl-fk',
        documentId: 'doc-csdl',
        chapter: 'Chương 2 – Mô hình quan hệ và Ràng buộc toàn vẹn',
        section: '2.2 – Khóa chính và Toàn vẹn tham chiếu',
        name: 'Khóa ngoại (Foreign Key)',
        type: 'rule',
        description: 'Thuộc tính tham chiếu đến khóa chính của bảng khác để đảm bảo tính toàn vẹn tham chiếu giữa các thực thể.',
        importance: 'core',
        sourceChunkId: 'chunk-csdl-2.2b',
        sourceText: 'Khóa ngoại là một hoặc tập thuộc tính trong quan hệ này tham chiếu đến khóa chính của quan hệ khác. Giá trị của khóa ngoại bắt buộc phải tồn tại ở khóa chính hoặc là giá trị NULL.',
        pageNumber: 26,
      },
      {
        id: 'ku-csdl-relmodel',
        documentId: 'doc-csdl',
        chapter: 'Chương 2 – Mô hình quan hệ và Ràng buộc toàn vẹn',
        section: '2.1 – Cấu trúc mô hình quan hệ',
        name: 'Mô hình dữ liệu quan hệ',
        type: 'concept',
        description: 'Biểu diễn dữ liệu dưới dạng các bảng hai chiều gồm các dòng (bộ) và các cột (thuộc tính) với miền giá trị nguyên tố.',
        importance: 'core',
        sourceChunkId: 'chunk-csdl-2.1',
        sourceText: 'Mô hình dữ liệu quan hệ do E.F. Codd đề xuất tổ chức dữ liệu thành các quan hệ (bảng), mỗi bộ (hàng) biểu diễn một thực thể và mỗi thuộc tính (cột) nhận giá trị nguyên tố đơn trị.',
        pageNumber: 18,
      },
      {
        id: 'ku-csdl-select',
        documentId: 'doc-csdl',
        chapter: 'Chương 3 – Ngôn ngữ truy vấn có cấu trúc SQL',
        section: '3.2 – Cú pháp câu lệnh SELECT',
        name: 'Câu lệnh SELECT',
        type: 'rule',
        description: 'Cú pháp cơ bản trích xuất dữ liệu trong SQL với các mệnh đề SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY.',
        importance: 'core',
        sourceChunkId: 'chunk-csdl-3.2',
        sourceText: 'Cú pháp cơ bản của câu lệnh SELECT gồm các mệnh đề: SELECT danh_sách FROM tên_bảng WHERE điều_kiện. Mệnh đề FROM là bắt buộc để xác định bảng nguồn chứa dữ liệu cần truy xuất.',
        pageNumber: 42,
      },
      {
        id: 'ku-csdl-join',
        documentId: 'doc-csdl',
        chapter: 'Chương 3 – Ngôn ngữ truy vấn có cấu trúc SQL',
        section: '3.3 – Các phép kết nối bảng (JOIN)',
        name: 'Phép kết nối bảng (JOIN)',
        type: 'process',
        description: 'Thao tác liên kết dữ liệu giữa các bảng dựa trên điều kiện quan hệ như INNER JOIN, LEFT JOIN, RIGHT JOIN và FULL OUTER JOIN.',
        importance: 'core',
        sourceChunkId: 'chunk-csdl-3.3',
        sourceText: 'Phép kết nối JOIN cho phép kết hợp các dòng từ hai hay nhiều bảng dựa trên các cột có liên quan. INNER JOIN trả về các bản ghi có giá trị khớp ở cả hai bảng, trong khi LEFT JOIN giữ lại toàn bộ bản ghi của bảng bên trái.',
        pageNumber: 48,
      },
      {
        id: 'ku-csdl-groupby',
        documentId: 'doc-csdl',
        chapter: 'Chương 3 – Ngôn ngữ truy vấn có cấu trúc SQL',
        section: '3.2 – Cú pháp câu lệnh SELECT',
        name: 'Mệnh đề GROUP BY & HAVING',
        type: 'rule',
        description: 'Gom nhóm các dòng dữ liệu có cùng giá trị và áp dụng hàm tổng hợp (COUNT, SUM, AVG) với điều kiện lọc sau gom nhóm bằng HAVING.',
        importance: 'important',
        sourceChunkId: 'chunk-csdl-3.2b',
        sourceText: 'Mệnh đề GROUP BY dùng để gom các dòng có chung giá trị thuộc tính. Mệnh đề HAVING được dùng để thiết lập điều kiện lọc trên các nhóm đã gom, khác với WHERE dùng lọc từng dòng riêng lẻ.',
        pageNumber: 45,
      },
      {
        id: 'ku-csdl-norm',
        documentId: 'doc-csdl',
        chapter: 'Chương 4 – Lý thuyết chuẩn hóa dữ liệu',
        section: '4.2 – Chuẩn hóa Normalization (1NF - BCNF)',
        name: 'Chuẩn hóa dữ liệu (Normalization)',
        type: 'process',
        description: 'Quá trình phân rã các quan hệ để loại bỏ dư thừa dữ liệu và loại trừ các dị thường thêm, sửa, xóa.',
        importance: 'core',
        sourceChunkId: 'chunk-csdl-4.2',
        sourceText: 'Chuẩn hóa dữ liệu là quá trình phân rã có hệ thống các quan hệ nhằm loại bỏ sự dư thừa dữ liệu và ngăn ngừa các dị thường dữ liệu trong quá trình thêm, xóa và sửa.',
        pageNumber: 52,
      },
      {
        id: 'ku-csdl-fd',
        documentId: 'doc-csdl',
        chapter: 'Chương 4 – Lý thuyết chuẩn hóa dữ liệu',
        section: '4.1 – Phụ thuộc hàm (Functional Dependency)',
        name: 'Phụ thuộc hàm (Functional Dependency)',
        type: 'definition',
        description: 'Mối quan hệ ràng buộc giữa các tập thuộc tính: X xác định hàm Y nếu mỗi giá trị của X tương ứng với duy nhất một giá trị của Y.',
        importance: 'core',
        sourceChunkId: 'chunk-csdl-4.1',
        sourceText: 'Phụ thuộc hàm X -> Y trên quan hệ R biểu thị rằng nếu hai bộ có cùng giá trị trên tập thuộc tính X thì chúng bắt buộc phải có cùng giá trị trên tập thuộc tính Y.',
        pageNumber: 63,
      },
      {
        id: 'ku-csdl-normalforms',
        documentId: 'doc-csdl',
        chapter: 'Chương 4 – Lý thuyết chuẩn hóa dữ liệu',
        section: '4.2 – Chuẩn hóa Normalization (1NF - BCNF)',
        name: 'Các dạng chuẩn (1NF, 2NF, 3NF, BCNF)',
        type: 'rule',
        description: 'Hệ thống cấp bậc dạng chuẩn: 1NF miền giá trị nguyên tố, 2NF không phụ thuộc một phần vào khóa chính, 3NF không phụ thuộc bắc cầu, BCNF mọi định thức là siêu khóa.',
        importance: 'core',
        sourceChunkId: 'chunk-csdl-4.2b',
        sourceText: 'Dạng chuẩn 1NF yêu cầu các thuộc tính có giá trị nguyên tố. Dạng chuẩn 2NF loại bỏ phụ thuộc một phần vào khóa chính. Dạng chuẩn 3NF loại bỏ phụ thuộc bắc cầu. Dạng chuẩn Boyce-Codd (BCNF) yêu cầu mọi thuộc tính xác định hàm đều là siêu khóa.',
        pageNumber: 56,
      },
    ],
  },
  {
    id: 'doc-net-osi',
    title: 'Mạng máy tính & Mô hình OSI',
    category: 'Mạng máy tính',
    description: 'Giáo trình phân tích chuyên sâu 7 tầng mô hình tham chiếu OSI, bộ giao thức TCP/IP, bắt tay 3 bước và an toàn mạng.',
    fileName: 'Mạng máy tính.pdf',
    fileSize: '4.2 MB',
    pageCount: 65,
    content: `GIÁO TRÌNH MẠNG MÁY TÍNH VÀ TRUYỀN THÔNG DỮ LIỆU
CHƯƠNG 1: TỔNG QUAN VỀ HỆ THỐNG MẠNG
1.1. Khái niệm và phân loại mạng LAN, MAN, WAN:
Mạng máy tính là một tập hợp các máy tính và thiết bị đầu cuối được kết nối với nhau thông qua các đường truyền vật lý và tuân theo một tập các quy tắc truyền thông (giao thức). Mạng cục bộ (LAN) kết nối trong phạm vi địa lý hẹp như tòa nhà, trường học. Mạng diện rộng (WAN) kết nối xuyên biên giới quốc gia, điển hình là mạng Internet.

CHƯƠNG 2: MÔ HÌNH MẠNG OSI VÀ BỘ GIAO THỨC TCP/IP
2.1. Kiến trúc mô hình OSI:
Mô hình OSI (Open Systems Interconnection) do tổ chức tiêu chuẩn hóa quốc tế ISO ban hành, được chia thành 7 tầng độc lập:
- Tầng 1: Tầng Vật lý (Physical Layer) - truyền các dòng bit nhị phân qua môi trường cáp hoặc sóng.
- Tầng 2: Tầng Liên kết dữ liệu (Data Link Layer) - đóng gói khung (Frame), định địa chỉ MAC, kiểm soát lỗi CRC.
- Tầng 3: Tầng Mạng (Network Layer) - định tuyến gói tin (Packet), địa chỉ logic IP.
- Tầng 4: Tầng Giao vận (Transport Layer) - truyền dữ liệu đầu cuối-đầu cuối (End-to-End), phân đoạn (Segment).
- Tầng 5: Tầng Phiên (Session Layer) - thiết lập, duy trì và giải phóng phiên đối thoại.
- Tầng 6: Tầng Trình diễn (Presentation Layer) - mã hóa, nén và định dạng dữ liệu.
- Tầng 7: Tầng Ứng dụng (Application Layer) - giao diện người dùng và dịch vụ mạng (HTTP, DNS, FTP).
2.2. Bộ giao thức TCP/IP và so sánh với OSI:
Mô hình TCP/IP gồm 4 tầng: Tầng Truy cập mạng, Tầng Internet (IP, ICMP, ARP), Tầng Giao vận (TCP, UDP), Tầng Ứng dụng (HTTP, FTP, SMTP, DNS).
2.3. Các giao thức tầng ứng dụng phổ biến (HTTP, HTTPS, DNS):
HTTP (Hypertext Transfer Protocol) hoạt động theo mô hình client-server trên cổng 80, truyền nhận bản tin request và response. Các phương thức HTTP phổ biến gồm GET (lấy tài nguyên), POST (gửi dữ liệu lên server), PUT (cập nhật), DELETE (xóa).

CHƯƠNG 3: AN TOÀN BẢO MẬT HỆ THỐNG MẠNG
3.1. Các mối đe dọa an ninh mạng: DoS, DDoS, Man-in-the-Middle.
3.2. Mật mã học và tường lửa (Firewall):
Mã hóa đối xứng (AES, DES) dùng chung một khóa. Mã hóa công khai bất đối xứng (RSA) dùng cặp khóa Public Key và Private Key.`,
    chapters: [
      {
        id: 'chap-net-1',
        chapterNumber: 1,
        title: 'Chương 1 – Tổng quan về Hệ thống mạng',
        pageStart: 1,
        pageEnd: 15,
        sections: [
          { id: 'sec-net-1.1', chapterId: 'chap-net-1', sectionNumber: '1.1', title: 'Khái niệm và phân loại mạng LAN, WAN', page: 3 },
        ],
      },
      {
        id: 'chap-net-2',
        chapterNumber: 2,
        title: 'Chương 2 – Mô hình mạng OSI',
        pageStart: 16,
        pageEnd: 45,
        sections: [
          { id: 'sec-net-2.1', chapterId: 'chap-net-2', sectionNumber: '2.1', title: 'Kiến trúc mô hình OSI', page: 18 },
          { id: 'sec-net-2.2', chapterId: 'chap-net-2', sectionNumber: '2.2', title: 'Bộ giao thức TCP/IP', page: 26 },
          { id: 'sec-net-2.3', chapterId: 'chap-net-2', sectionNumber: '2.3', title: 'Các giao thức tầng ứng dụng (HTTP, DNS)', page: 34 },
        ],
      },
      {
        id: 'chap-net-3',
        chapterNumber: 3,
        title: 'Chương 3 – An toàn bảo mật hệ thống mạng',
        pageStart: 46,
        pageEnd: 65,
        sections: [
          { id: 'sec-net-3.1', chapterId: 'chap-net-3', sectionNumber: '3.1', title: 'Mối đe dọa an ninh mạng', page: 48 },
          { id: 'sec-net-3.2', chapterId: 'chap-net-3', sectionNumber: '3.2', title: 'Mật mã học và Tường lửa', page: 54 },
        ],
      },
    ],
    knowledgeUnits: [
      {
        id: 'ku-net-osi',
        documentId: 'doc-net-osi',
        chapter: 'Chương 2 – Mô hình mạng OSI',
        section: '2.1. Kiến trúc mô hình OSI',
        name: 'Mô hình OSI',
        type: 'principle',
        description: 'Mô hình tham chiếu kiến trúc mạng phân tầng gồm 7 tầng từ Vật lý đến Ứng dụng do ISO chuẩn hóa.',
        importance: 'core',
        sourceChunkId: 'chunk-net-2.1',
        sourceText: 'Mô hình OSI (Open Systems Interconnection) do tổ chức tiêu chuẩn hóa quốc tế ISO ban hành, được chia thành 7 tầng độc lập: Vật lý, Liên kết dữ liệu, Mạng, Giao vận, Phiên, Trình diễn, Ứng dụng.',
        pageNumber: 18,
      },
      {
        id: 'ku-net-http',
        documentId: 'doc-net-osi',
        chapter: 'Chương 2 – Mô hình mạng OSI',
        section: '2.3. Các giao thức tầng ứng dụng',
        name: 'HTTP methods',
        type: 'concept',
        description: 'Các phương thức yêu cầu HTTP client-server bao gồm GET, POST, PUT, DELETE.',
        importance: 'important',
        sourceChunkId: 'chunk-net-2.3',
        sourceText: 'HTTP hoạt động theo mô hình client-server trên cổng 80. Các phương thức HTTP phổ biến gồm GET (lấy tài nguyên), POST (gửi dữ liệu), PUT (cập nhật), DELETE (xóa).',
        pageNumber: 34,
      },
    ],
  },
  {
    id: 'doc-bio-12',
    title: 'Sinh học 12: Cơ chế di truyền & Quy luật Menđen',
    category: 'Sinh học',
    description: 'Chuyên đề ADN, ARN, đột biến gen và các quy luật di truyền Menđen, phân ly độc lập, tương tác gen.',
    fileName: 'SinhHoc12_ChuyenDeDiTruyen.pdf',
    fileSize: '2.8 MB',
    pageCount: 40,
    content: `CHUYÊN ĐỀ: CƠ CHẾ DI TRUYỀN VÀ BIẾN DỊ Ở CẤP ĐỘ PHÂN TỬ VÀ TẾ BÀO
CHƯƠNG 1: CƠ CHẾ DI TRUYỀN CẤP ĐỘ PHÂN TỬ
1.1. Gen và mã di truyền:
Gen là một đoạn phân tử ADN mang thông tin mã hóa một chuỗi pôlipeptit hay một phân tử ARN. Mã di truyền là mã bộ ba được đọc từ một điểm xác định theo từng cụm 3 nuclêôtit theo chiều 5' đến 3'. Mã di truyền có tính thoái hóa (nhiều bộ ba cùng mã hóa cho một loại axit amin, trừ AUG và UGG), tính phổ biến và tính đặc hiệu.
1.2. Quá trình nhân đôi ADN và phiên mã:
Nhân đôi diễn ra theo nguyên tắc bổ sung và bán bảo tồn. Enzim ADN pôlimeraza chỉ kéo dài mạch mới theo chiều 5' -> 3'.

CHƯƠNG 2: CÁC QUY LUẬT DI TRUYỀN MENĐEN
2.1. Quy luật phân ly của Menđen:
Menđen phát hiện quy luật phân ly bằng phép lai 1 cặp tính trạng tương phản ở đậu Hà Lan. Tỉ lệ kiểu hình F2 là 3 trội : 1 lặn.
2.2. Quy luật phân ly độc lập:
Khi lai 2 hay nhiều cặp tính trạng tương phản phân ly độc lập, tỉ lệ phân ly kiểu hình ở F2 bằng tích tỉ lệ phân ly của các cặp tính trạng hợp thành nó (tỉ lệ 9:3:3:1).`,
    chapters: [
      {
        id: 'chap-bio-1',
        chapterNumber: 1,
        title: 'Chương 1 – Cơ chế di truyền cấp độ phân tử',
        pageStart: 1,
        pageEnd: 20,
        sections: [
          { id: 'sec-bio-1.1', chapterId: 'chap-bio-1', sectionNumber: '1.1', title: 'Gen và mã di truyền', page: 4 },
          { id: 'sec-bio-1.2', chapterId: 'chap-bio-1', sectionNumber: '1.2', title: 'Cơ chế nhân đôi ADN', page: 12 },
        ],
      },
      {
        id: 'chap-bio-2',
        chapterNumber: 2,
        title: 'Chương 2 – Các quy luật di truyền Menđen',
        pageStart: 21,
        pageEnd: 40,
        sections: [
          { id: 'sec-bio-2.1', chapterId: 'chap-bio-2', sectionNumber: '2.1', title: 'Quy luật phân ly', page: 23 },
          { id: 'sec-bio-2.2', chapterId: 'chap-bio-2', sectionNumber: '2.2', title: 'Quy luật phân ly độc lập', page: 31 },
        ],
      },
    ],
    knowledgeUnits: [
      {
        id: 'ku-bio-code',
        documentId: 'doc-bio-12',
        chapter: 'Chương 1 – Cơ chế di truyền cấp độ phân tử',
        section: '1.1. Gen và mã di truyền',
        name: 'Tính thoái hóa của mã di truyền',
        type: 'definition',
        description: 'Đặc tính dư thừa của mã di truyền giúp hạn chế ảnh hưởng của các đột biến thay thế nuclêôtit.',
        importance: 'core',
        sourceChunkId: 'chunk-bio-1.1',
        sourceText: 'Mã di truyền có tính thoái hóa (nhiều bộ ba cùng mã hóa cho một loại axit amin, trừ AUG và UGG), tính phổ biến và tính đặc hiệu.',
        pageNumber: 4,
      },
    ],
  },
];

// Rich Initial Questions for CSDL.pdf (Matches exact Test Cases 1, 2, 3, 4)
export const INITIAL_QUIZ_SET: QuizSet = {
  id: 'quiz-csdl-exam-01',
  title: 'Đề thi trắc nghiệm Cơ sở dữ liệu & Ngôn ngữ SQL',
  documentId: 'doc-csdl',
  documentName: 'CSDL.pdf',
  documentExcerpt: 'Giáo trình Cơ sở dữ liệu quan hệ, câu lệnh truy vấn SQL (SELECT, FROM, WHERE) và lý thuyết chuẩn hóa dữ liệu (1NF, 2NF, 3NF, BCNF).',
  createdAt: 'Hôm nay, 10:15',
  totalQuestions: 10,
  recommendedMinutes: 20,
  difficulty: 'medium',
  questionType: 'multiple_choice',
  quizStyle: 'standard',
  rawDocumentText: SAMPLE_DOCUMENTS[0].content,
  chapters: SAMPLE_DOCUMENTS[0].chapters,
  knowledgeUnits: SAMPLE_DOCUMENTS[0].knowledgeUnits,
  matrix: {
    chapterDistributions: [
      { chapterId: 'chap-csdl-1', chapterTitle: 'Chương 1 – Tổng quan về Hệ cơ sở dữ liệu', easy: 1, medium: 1, hard: 0, total: 2 },
      { chapterId: 'chap-csdl-2', chapterTitle: 'Chương 2 – Mô hình quan hệ và Ràng buộc toàn vẹn', easy: 1, medium: 1, hard: 1, total: 3 },
      { chapterId: 'chap-csdl-3', chapterTitle: 'Chương 3 – Ngôn ngữ truy vấn có cấu trúc SQL', easy: 1, medium: 2, hard: 0, total: 3 },
      { chapterId: 'chap-csdl-4', chapterTitle: 'Chương 4 – Lý thuyết chuẩn hóa dữ liệu', easy: 0, medium: 1, hard: 1, total: 2 },
    ],
    totalEasy: 3,
    totalMedium: 5,
    totalHard: 2,
    grandTotal: 10,
  },
  questions: [
    {
      id: 'q-csdl-01',
      questionNumber: 1,
      questionText: 'Trong kiến trúc 3 mức ANSI/SPARC của hệ CSDL, mức nào thể hiện góc nhìn dữ liệu toàn cục logic của tổ chức?',
      options: [
        { key: 'A', text: 'Mức quan niệm (Conceptual Level).' },
        { key: 'B', text: 'Mức trong (Internal Level).' },
        { key: 'C', text: 'Mức ngoài (External Level).' },
        { key: 'D', text: 'Mức vật lý (Physical Storage Level).' },
      ],
      correctAnswer: 'A',
      explanation: 'Mức quan niệm (Conceptual schema) mô tả toàn bộ cấu trúc logic của cơ sở dữ liệu, che giấu các chi tiết về cấu trúc lưu trữ vật lý ở mức trong và tổng hợp các góc nhìn cục bộ của mức ngoài.',
      difficulty: 'easy',
      topic: 'Kiến trúc ANSI/SPARC',
      source: {
        documentId: 'doc-csdl',
        documentName: 'CSDL.pdf',
        chapter: 'Chương 1 – Tổng quan về Hệ cơ sở dữ liệu',
        section: '1.2. Tính độc lập dữ liệu và mô hình 3 mức',
        page: 8,
        sourceChunkId: 'chunk-csdl-1.2',
        sourceText: 'Mô hình kiến trúc ANSI/SPARC chia hệ CSDL thành 3 mức trừu tượng: Mức ngoài (Khung nhìn người dùng), Mức quan niệm (Lược đồ dữ liệu logic toàn cục), Mức trong (Cấu trúc lưu trữ vật lý trên đĩa).',
        knowledgeUnit: 'Mô hình 3 mức ANSI/SPARC',
        generationReason: 'Kiểm tra khả năng phân biệt 3 mức trừu tượng của kiến trúc CSDL tiêu chuẩn được trình bày tại mục 1.2 của tài liệu.',
      },
      validation: {
        isValid: true,
        status: 'VALID',
        checks: {
          hasFourOptions: true,
          hasSingleCorrect: true,
          answerInSource: true,
          explanationMatchesSource: true,
          hasSourceMapping: true,
          hasReason: true,
          noDuplicateOptions: true,
        },
      },
    },
    {
      id: 'q-csdl-02',
      questionNumber: 2,
      questionText: 'Khóa chính (Primary Key) của một quan hệ bắt buộc phải thỏa mãn điều kiện nào sau đây theo ràng buộc toàn vẹn thực thể?',
      options: [
        { key: 'A', text: 'Phải là khóa ngoại của một quan hệ khác trong cùng lược đồ.' },
        { key: 'B', text: 'Tối thiểu xác định duy nhất mỗi bộ và không được phép chứa giá trị NULL.' },
        { key: 'C', text: 'Phải gồm ít nhất từ 2 thuộc tính số nguyên trở lên.' },
        { key: 'D', text: 'Được phép nhận giá trị trùng lặp giữa các bản ghi nếu được chỉ định UNIQUE.' },
      ],
      correctAnswer: 'B',
      explanation: 'Ràng buộc toàn vẹn thực thể quy định khóa chính là tập thuộc tính tối thiểu định danh duy nhất mỗi bộ trong quan hệ và không bất kỳ thuộc tính nào của khóa chính được nhận giá trị NULL.',
      difficulty: 'easy',
      topic: 'Khóa chính và Ràng buộc toàn vẹn',
      source: {
        documentId: 'doc-csdl',
        documentName: 'CSDL.pdf',
        chapter: 'Chương 2 – Mô hình quan hệ và Ràng buộc toàn vẹn',
        section: '2.2. Khóa chính, khóa ngoại và tính toàn vẹn tham chiếu',
        page: 24,
        sourceChunkId: 'chunk-csdl-2.2',
        sourceText: 'Khóa chính (Primary Key) là một tập thuộc tính tối thiểu xác định duy nhất mỗi bộ trong quan hệ, không được phép chứa giá trị NULL (ràng buộc toàn vẹn thực thể).',
        knowledgeUnit: 'Primary Key & Foreign Key',
        generationReason: 'Đây là định nghĩa nền tảng về tính toàn vẹn thực thể của mô hình quan hệ trong Chương 2.',
      },
      validation: {
        isValid: true,
        status: 'VALID',
        checks: {
          hasFourOptions: true,
          hasSingleCorrect: true,
          answerInSource: true,
          explanationMatchesSource: true,
          hasSourceMapping: true,
          hasReason: true,
          noDuplicateOptions: true,
        },
      },
    },
    {
      id: 'q-csdl-03',
      questionNumber: 3,
      questionText: 'Trong ngôn ngữ SQL, mệnh đề nào sau đây là BẮT BUỘC phải có trong câu lệnh SELECT để chỉ định bảng nguồn dữ liệu?',
      options: [
        { key: 'A', text: 'Mệnh đề WHERE.' },
        { key: 'B', text: 'Mệnh đề FROM.' },
        { key: 'C', text: 'Mệnh đề GROUP BY.' },
        { key: 'D', text: 'Mệnh đề ORDER BY.' },
      ],
      correctAnswer: 'B',
      explanation: 'Trong cú pháp chuẩn của câu lệnh SELECT khi truy vấn từ cơ sở dữ liệu, mệnh đề FROM là bắt buộc để xác định bảng hoặc khung nhìn chứa các thuộc tính cần lấy.',
      difficulty: 'easy',
      topic: 'Cú pháp câu lệnh SELECT',
      source: {
        documentId: 'doc-csdl',
        documentName: 'CSDL.pdf',
        chapter: 'Chương 3 – Ngôn ngữ truy vấn có cấu trúc SQL',
        section: '3.2. Cú pháp và kỹ thuật truy vấn dữ liệu với câu lệnh SELECT',
        page: 42,
        sourceChunkId: 'chunk-csdl-3.2',
        sourceText: 'Cú pháp cơ bản của câu lệnh SELECT gồm các mệnh đề: SELECT danh_sách FROM tên_bảng WHERE điều_kiện. Mệnh đề FROM là bắt buộc để xác định bảng nguồn chứa dữ liệu cần truy xuất.',
        knowledgeUnit: 'SELECT statement',
        generationReason: 'SELECT và FROM là cú pháp cơ bản và là kiến thức cốt lõi của chương SQL để trích xuất dữ liệu.',
      },
      validation: {
        isValid: true,
        status: 'VALID',
        checks: {
          hasFourOptions: true,
          hasSingleCorrect: true,
          answerInSource: true,
          explanationMatchesSource: true,
          hasSourceMapping: true,
          hasReason: true,
          noDuplicateOptions: true,
        },
      },
    },
    {
      id: 'q-csdl-04',
      questionNumber: 4,
      questionText: 'Điểm khác biệt căn bản giữa mệnh đề WHERE và mệnh đề HAVING trong câu lệnh SELECT là gì?',
      options: [
        { key: 'A', text: 'WHERE lọc từng dòng trước khi gom nhóm, HAVING lọc điều kiện sau khi đã thực hiện gom nhóm (GROUP BY).' },
        { key: 'B', text: 'WHERE chỉ dùng cho dữ liệu kiểu số, HAVING chỉ dùng cho dữ liệu kiểu chuỗi ký tự.' },
        { key: 'C', text: 'HAVING bắt buộc phải đứng trước mệnh đề WHERE trong cấu trúc câu lệnh.' },
        { key: 'D', text: 'WHERE có thể sử dụng các hàm tổng hợp như SUM, COUNT; HAVING thì không thể.' },
      ],
      correctAnswer: 'A',
      explanation: 'WHERE dùng để lọc các dòng bản ghi riêng lẻ trước khi chúng được đưa vào gom nhóm. Ngược lại, HAVING được áp dụng sau bước gom nhóm để lọc các nhóm dựa trên điều kiện của hàm tổng hợp.',
      difficulty: 'medium',
      topic: 'Kỹ thuật SELECT nâng cao',
      source: {
        documentId: 'doc-csdl',
        documentName: 'CSDL.pdf',
        chapter: 'Chương 3 – Ngôn ngữ truy vấn có cấu trúc SQL',
        section: '3.2. Cú pháp và kỹ thuật truy vấn dữ liệu với câu lệnh SELECT',
        page: 42,
        sourceChunkId: 'chunk-csdl-3.2',
        sourceText: 'Mệnh đề WHERE lọc từng dòng bản ghi trước khi gom nhóm, trong khi HAVING lọc dữ liệu sau khi đã thực hiện phép gom nhóm và tính toán hàm tổng hợp (COUNT, SUM, AVG, MIN, MAX).',
        knowledgeUnit: 'SELECT statement',
        generationReason: 'Câu hỏi nhằm kiểm tra năng lực phân biệt cơ chế thực thi của WHERE và HAVING, vốn là lỗi tư duy kinh điển của người học SQL.',
      },
      validation: {
        isValid: true,
        status: 'VALID',
        checks: {
          hasFourOptions: true,
          hasSingleCorrect: true,
          answerInSource: true,
          explanationMatchesSource: true,
          hasSourceMapping: true,
          hasReason: true,
          noDuplicateOptions: true,
        },
      },
    },
    {
      id: 'q-csdl-05',
      questionNumber: 5,
      questionText: 'Mô hình tham chiếu OSI gồm bao nhiêu tầng kiến trúc độc lập?',
      options: [
        { key: 'A', text: '4 tầng.' },
        { key: 'B', text: '5 tầng.' },
        { key: 'C', text: '7 tầng.' },
        { key: 'D', text: '9 tầng.' },
      ],
      correctAnswer: 'C',
      explanation: 'Mô hình OSI được tổ chức ISO chia thành 7 tầng: Vật lý, Liên kết dữ liệu, Mạng, Giao vận, Phiên, Trình diễn, Ứng dụng.',
      difficulty: 'easy',
      topic: 'Mô hình mạng OSI',
      source: {
        documentId: 'doc-net-osi',
        documentName: 'Mạng máy tính.pdf',
        chapter: 'Chương 2 – Mô hình mạng OSI',
        section: '2.1. Kiến trúc mô hình OSI',
        page: 18,
        sourceChunkId: 'chunk-net-2.1',
        sourceText: 'Mô hình OSI (Open Systems Interconnection) do tổ chức tiêu chuẩn hóa quốc tế ISO ban hành, được chia thành 7 tầng độc lập: Vật lý, Liên kết dữ liệu, Mạng, Giao vận, Phiên, Trình diễn, Ứng dụng.',
        knowledgeUnit: 'Mô hình OSI',
        generationReason: 'Đây là khái niệm nền tảng của Chương 2 và chứa thông tin định nghĩa quan trọng về phân tầng mạng.',
      },
      validation: {
        isValid: true,
        status: 'VALID',
        checks: {
          hasFourOptions: true,
          hasSingleCorrect: true,
          answerInSource: true,
          explanationMatchesSource: true,
          hasSourceMapping: true,
          hasReason: true,
          noDuplicateOptions: true,
        },
      },
      illustration: {
        needsImage: true,
        imageType: 'schema',
        imagePrompt: 'Sơ đồ phân tầng 7 lớp của mô hình OSI',
        caption: 'Mô hình 7 tầng OSI (ISO 7498)',
      },
    },
    {
      id: 'q-csdl-06',
      questionNumber: 6,
      questionText: 'Mục đích cốt lõi của quá trình chuẩn hóa dữ liệu (Normalization) trong thiết kế CSDL quan hệ là gì?',
      options: [
        { key: 'A', text: 'Tăng kích thước các bảng dữ liệu để tận dụng tối đa dung lượng ổ cứng lưu trữ.' },
        { key: 'B', text: 'Loại bỏ sự dư thừa dữ liệu và ngăn ngừa các dị thường khi thêm, xóa, sửa bản ghi.' },
        { key: 'C', text: 'Tự động tạo ra các câu lệnh truy vấn SELECT tối ưu nhất.' },
        { key: 'D', text: 'Chuyển đổi toàn bộ cơ sở dữ liệu quan hệ sang dạng NoSQL phi cấu trúc.' },
      ],
      correctAnswer: 'B',
      explanation: 'Chuẩn hóa dữ liệu là quá trình phân rã có hệ thống các quan hệ để loại bỏ sự dư thừa dữ liệu và ngăn ngừa các dị thường dữ liệu (insert, update, delete anomalies).',
      difficulty: 'medium',
      topic: 'Chuẩn hóa dữ liệu',
      source: {
        documentId: 'doc-csdl',
        documentName: 'CSDL.pdf',
        chapter: 'Chương 4 – Lý thuyết chuẩn hóa dữ liệu',
        section: '4.2. Quá trình chuẩn hóa dữ liệu (Normalization) từ 1NF đến BCNF',
        page: 52,
        sourceChunkId: 'chunk-csdl-4.2',
        sourceText: 'Chuẩn hóa dữ liệu là quá trình phân rã có hệ thống các quan hệ nhằm loại bỏ sự dư thừa dữ liệu và ngăn ngừa các dị thường dữ liệu trong quá trình thêm, xóa và sửa.',
        knowledgeUnit: 'Normalization',
        generationReason: 'Kiểm tra mục tiêu bản chất của việc chuẩn hóa lược đồ dữ liệu theo lý thuyết của E.F. Codd trong Chương 4.',
      },
      validation: {
        isValid: true,
        status: 'VALID',
        checks: {
          hasFourOptions: true,
          hasSingleCorrect: true,
          answerInSource: true,
          explanationMatchesSource: true,
          hasSourceMapping: true,
          hasReason: true,
          noDuplicateOptions: true,
        },
      },
    },
    {
      id: 'q-csdl-07',
      questionNumber: 7,
      questionText: 'Một quan hệ được công nhận đạt Dạng chuẩn 1 (1NF) khi và chỉ khi thỏa mãn điều kiện nào?',
      options: [
        { key: 'A', text: 'Đã có ít nhất hai khóa chính kết hợp.' },
        { key: 'B', text: 'Mọi thuộc tính đều chứa các giá trị nguyên tố (nguyên tử), không chứa thuộc tính đa trị.' },
        { key: 'C', text: 'Không còn tồn tại bất kỳ phụ thuộc hàm nào trong quan hệ.' },
        { key: 'D', text: 'Các thuộc tính không khóa đều phụ thuộc bắc cầu vào khóa chính.' },
      ],
      correctAnswer: 'B',
      explanation: 'Dạng chuẩn 1 (1NF) đòi hỏi miền giá trị của mọi thuộc tính trong quan hệ phải chỉ chứa các giá trị nguyên tử (atomic), không được phép chứa tập hợp (đa trị) hoặc thuộc tính lồng ghép phức hợp.',
      difficulty: 'medium',
      topic: 'Dạng chuẩn 1NF',
      source: {
        documentId: 'doc-csdl',
        documentName: 'CSDL.pdf',
        chapter: 'Chương 4 – Lý thuyết chuẩn hóa dữ liệu',
        section: '4.2. Quá trình chuẩn hóa dữ liệu (Normalization) từ 1NF đến BCNF',
        page: 52,
        sourceChunkId: 'chunk-csdl-4.2',
        sourceText: 'Dạng chuẩn 1 (1NF): Mọi thuộc tính đều chứa các giá trị nguyên tố (nguyên tử), không chứa thuộc tính đa trị hoặc thuộc tính phức hợp.',
        knowledgeUnit: 'Normalization',
        generationReason: '1NF là bậc chuẩn hóa tiên quyết nhất, câu hỏi kiểm tra khái niệm giá trị nguyên tố.',
      },
      validation: {
        isValid: true,
        status: 'VALID',
        checks: {
          hasFourOptions: true,
          hasSingleCorrect: true,
          answerInSource: true,
          explanationMatchesSource: true,
          hasSourceMapping: true,
          hasReason: true,
          noDuplicateOptions: true,
        },
      },
    },
    {
      id: 'q-csdl-08',
      questionNumber: 8,
      questionText: 'Một quan hệ đã ở dạng chuẩn 1NF, điều kiện bổ sung nào cần thiết để đạt Dạng chuẩn 2 (2NF)?',
      options: [
        { key: 'A', text: 'Không còn phụ thuộc bắc cầu giữa các thuộc tính không khóa.' },
        { key: 'B', text: 'Mọi thuộc tính không khóa đều phải phụ thuộc hàm đầy đủ vào khóa chính.' },
        { key: 'C', text: 'Bắt buộc phải có khóa ngoại tham chiếu đến bảng danh mục.' },
        { key: 'D', text: 'Khóa chính chỉ được phép có duy nhất 1 thuộc tính đơn.' },
      ],
      correctAnswer: 'B',
      explanation: 'Để đạt 2NF, quan hệ phải đạt 1NF và mọi thuộc tính không khóa phải phụ thuộc đầy đủ vào toàn bộ khóa chính, nghĩa là loại bỏ triệt để hiện tượng phụ thuộc từng phần vào một phần của khóa phức hợp.',
      difficulty: 'hard',
      topic: 'Dạng chuẩn 2NF',
      source: {
        documentId: 'doc-csdl',
        documentName: 'CSDL.pdf',
        chapter: 'Chương 4 – Lý thuyết chuẩn hóa dữ liệu',
        section: '4.2. Quá trình chuẩn hóa dữ liệu (Normalization) từ 1NF đến BCNF',
        page: 52,
        sourceChunkId: 'chunk-csdl-4.2',
        sourceText: 'Dạng chuẩn 2 (2NF): Đạt 1NF và mọi thuộc tính không khóa đều phụ thuộc hàm đầy đủ vào khóa chính (loại bỏ phụ thuộc từng phần vào khóa phức hợp).',
        knowledgeUnit: 'Normalization',
        generationReason: 'Kiểm tra khả năng phân biệt phụ thuộc hàm đầy đủ và phụ thuộc bộ phận trong chuẩn hóa CSDL.',
      },
      validation: {
        isValid: true,
        status: 'VALID',
        checks: {
          hasFourOptions: true,
          hasSingleCorrect: true,
          answerInSource: true,
          explanationMatchesSource: true,
          hasSourceMapping: true,
          hasReason: true,
          noDuplicateOptions: true,
        },
      },
    },
    {
      id: 'q-csdl-09',
      questionNumber: 9,
      questionText: 'Phép nối LEFT OUTER JOIN giữa bảng A và bảng B trong SQL sẽ xử lý các dòng ở bảng A không khớp với bảng B như thế nào?',
      options: [
        { key: 'A', text: 'Tự động loại bỏ hoàn toàn các dòng đó khỏi kết quả truy vấn.' },
        { key: 'B', text: 'Vẫn giữ lại các dòng của bảng A và điền giá trị NULL cho các cột của bảng B.' },
        { key: 'C', text: 'Báo lỗi vi phạm toàn vẹn dữ liệu và dừng câu truy vấn.' },
        { key: 'D', text: 'Tự động nhân bản các dòng của bảng B để bù đắp.' },
      ],
      correctAnswer: 'B',
      explanation: 'LEFT OUTER JOIN bảo toàn mọi bản ghi từ bảng bên trái (A). Nếu bản ghi không tìm thấy đối sánh tương ứng ở bảng bên phải (B), các cột thuộc bảng B sẽ được gán giá trị NULL.',
      difficulty: 'medium',
      topic: 'Các phép kết nối JOIN',
      source: {
        documentId: 'doc-csdl',
        documentName: 'CSDL.pdf',
        chapter: 'Chương 3 – Ngôn ngữ truy vấn có cấu trúc SQL',
        section: '3.3. Các phép kết nối bảng (JOIN)',
        page: 50,
        sourceChunkId: 'chunk-csdl-3.3',
        sourceText: 'LEFT OUTER JOIN trả về toàn bộ dữ liệu ở bảng bên trái kèm dữ liệu khớp ở bảng bên phải; nếu không khớp, các thuộc tính bảng phải sẽ nhận giá trị NULL.',
        knowledgeUnit: 'SELECT statement',
        generationReason: 'Đánh giá kỹ năng vận dụng câu lệnh kết nối dữ liệu nhiều bảng trong SQL thực tế.',
      },
      validation: {
        isValid: true,
        status: 'VALID',
        checks: {
          hasFourOptions: true,
          hasSingleCorrect: true,
          answerInSource: true,
          explanationMatchesSource: true,
          hasSourceMapping: true,
          hasReason: true,
          noDuplicateOptions: true,
        },
      },
    },
    {
      id: 'q-csdl-10',
      questionNumber: 10,
      questionText: 'Khái niệm Dạng chuẩn Boyce-Codd (BCNF) đặt ra yêu cầu gì đối với mọi phụ thuộc hàm không tầm thường X -> Y?',
      options: [
        { key: 'A', text: 'Y bắt buộc phải là một khóa chính.' },
        { key: 'B', text: 'X bắt buộc phải là một siêu khóa (Superkey).' },
        { key: 'C', text: 'Số lượng thuộc tính của X phải luôn lớn hơn Y.' },
        { key: 'D', text: 'Không được phép có quá 3 thuộc tính trong quan hệ.' },
      ],
      correctAnswer: 'B',
      explanation: 'Dạng chuẩn BCNF là dạng chuẩn hóa chặt chẽ hơn 3NF, yêu cầu với mọi phụ thuộc hàm không tầm thường X -> Y thì vế trái X phải là một siêu khóa của quan hệ.',
      difficulty: 'hard',
      topic: 'Dạng chuẩn BCNF',
      source: {
        documentId: 'doc-csdl',
        documentName: 'CSDL.pdf',
        chapter: 'Chương 4 – Lý thuyết chuẩn hóa dữ liệu',
        section: '4.2. Quá trình chuẩn hóa dữ liệu (Normalization) từ 1NF đến BCNF',
        page: 52,
        sourceChunkId: 'chunk-csdl-4.2',
        sourceText: 'Dạng chuẩn Boyce-Codd (BCNF): Với mọi phụ thuộc hàm không tầm thường X -> Y, X phải là một siêu khóa.',
        knowledgeUnit: 'Normalization',
        generationReason: 'BCNF là mức chuẩn hóa nâng cao, kiểm tra khả năng tư duy trừu tượng về siêu khóa và phụ thuộc hàm.',
      },
      validation: {
        isValid: true,
        status: 'VALID',
        checks: {
          hasFourOptions: true,
          hasSingleCorrect: true,
          answerInSource: true,
          explanationMatchesSource: true,
          hasSourceMapping: true,
          hasReason: true,
          noDuplicateOptions: true,
        },
      },
    },
  ],
};

// Initial Attempt for CSDL exam showcasing Learning Traceability (Section 30, 31)
export const INITIAL_QUIZ_ATTEMPT: QuizAttempt = {
  id: 'att-csdl-01',
  quizId: INITIAL_QUIZ_SET.id,
  quizTitle: INITIAL_QUIZ_SET.title,
  completedAt: 'Hôm nay, 10:45',
  timeSpentSeconds: 540,
  answers: {
    'q-csdl-01': 'A',
    'q-csdl-02': 'B',
    'q-csdl-03': 'B',
    'q-csdl-04': 'A',
    'q-csdl-05': 'C',
    'q-csdl-06': 'A', // Sai câu 6 (Chuẩn hóa) -> Học viên chọn A
    'q-csdl-07': 'B',
    'q-csdl-08': 'A', // Sai câu 8 (2NF) -> Học viên chọn A
    'q-csdl-09': 'B',
    'q-csdl-10': 'C', // Sai câu 10 (BCNF) -> Học viên chọn C
  },
  flaggedQuestions: ['q-csdl-08', 'q-csdl-10'],
  score: 7.0,
  percentage: 70,
  correctCount: 7,
  wrongCount: 3,
  unansweredCount: 0,
  totalQuestions: 10,
  categoryBreakdown: [
    { category: 'Tổng quan CSDL', correct: 2, total: 2, accuracy: 100 },
    { category: 'Truy vấn SQL (SELECT & JOIN)', correct: 3, total: 3, accuracy: 100 },
    { category: 'Mô hình mạng OSI', correct: 1, total: 1, accuracy: 100 },
    { category: 'Chuẩn hóa dữ liệu (Normalization)', correct: 1, total: 4, accuracy: 25 },
  ],
  difficultyBreakdown: [
    { difficulty: 'easy', label: 'Dễ (Nhận biết)', correct: 4, total: 4 },
    { difficulty: 'medium', label: 'Trung bình (Thông hiểu)', correct: 3, total: 4 },
    { difficulty: 'hard', label: 'Khó (Vận dụng)', correct: 0, total: 2 },
  ],
  missedKnowledgeUnits: [
    {
      questionId: 'q-csdl-06',
      questionNumber: 6,
      knowledgeUnit: 'Normalization',
      chapter: 'Chương 4 – Lý thuyết chuẩn hóa dữ liệu',
      section: '4.2. Quá trình chuẩn hóa dữ liệu',
      page: 52,
      sourceText: 'Chuẩn hóa dữ liệu là quá trình phân rã có hệ thống các quan hệ nhằm loại bỏ sự dư thừa dữ liệu và ngăn ngừa các dị thường dữ liệu trong quá trình thêm, xóa và sửa.',
      reason: 'Cần ôn lại định nghĩa bản chất của Chuẩn hóa dữ liệu: nhằm loại bỏ dư thừa và dị thường thao tác.',
    },
    {
      questionId: 'q-csdl-08',
      questionNumber: 8,
      knowledgeUnit: 'Normalization',
      chapter: 'Chương 4 – Lý thuyết chuẩn hóa dữ liệu',
      section: '4.2. Quá trình chuẩn hóa dữ liệu',
      page: 52,
      sourceText: 'Dạng chuẩn 2 (2NF): Đạt 1NF và mọi thuộc tính không khóa đều phụ thuộc hàm đầy đủ vào khóa chính (loại bỏ phụ thuộc từng phần vào khóa phức hợp).',
      reason: 'Cần xem lại điều kiện phụ thuộc hàm đầy đủ vào khóa chính để phân biệt 2NF với 3NF.',
    },
    {
      questionId: 'q-csdl-10',
      questionNumber: 10,
      knowledgeUnit: 'Normalization',
      chapter: 'Chương 4 – Lý thuyết chuẩn hóa dữ liệu',
      section: '4.2. Quá trình chuẩn hóa dữ liệu',
      page: 52,
      sourceText: 'Dạng chuẩn Boyce-Codd (BCNF): Với mọi phụ thuộc hàm không tầm thường X -> Y, X phải là một siêu khóa.',
      reason: 'Cần ôn lại điều kiện vế trái của phụ thuộc hàm phải là siêu khóa trong BCNF.',
    },
  ],
};

export const RECENT_QUIZZES_LIST: QuizSet[] = [INITIAL_QUIZ_SET];
