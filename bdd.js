const { Pool } = require('pg');

const pool = new Pool({
  user: "avnadmin",
  password: "AVNS_fzEUlxFV6INkrwq8z3S",
  host: "manasoa-db-manasoa-education.c.aivencloud.com",
  port: 10955,
  database: "defaultdb",
  ssl: {
        rejectUnauthorized: true,
        ca: `-----BEGIN CERTIFICATE-----
MIIETTCCArWgAwIBAgIUXSdAP/Yb2q+a8k9EC3B5Jc05rUowDQYJKoZIhvcNAQEM
BQAwQDE+MDwGA1UEAww1MzRjNGQyNjMtZTYwYi00MmFiLWE2NDQtYWUxZmVlMGZk
ZWFmIEdFTiAxIFByb2plY3QgQ0EwHhcNMjUwNDA1MDgxNzM1WhcNMzUwNDAzMDgx
NzM1WjBAMT4wPAYDVQQDDDUzNGM0ZDI2My1lNjBiLTQyYWItYTY0NC1hZTFmZWUw
ZmRlYWYgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCC
AYoCggGBANecFL/M9S67IRhba+ENug9DpNaEdlCi4jO/c1LUJH8dPcEIEZxEzg3q
WwLbpFM8jEpy8TQy+wEuejovLlYC6HZNj1oZpJtxml7IcS3KnRZI9frukO7Xe57+
ZmI5RsDdrGYsszCQ66cRmHhn7gxrqu5xcMl2gJD/r9d2duZiHo5UDTXky38tzroi
uVZrlYbiNBXznMETGR/D2C1cDjIl76U8tHq3Hjtw+xQMGaUX9h3w5co4lGBA8Xe0
FhjU4WQw+w4xXfko1NQ/JDdveqXFCpY5HaAVuNrp8j+bDCRbqa5UoqWHEiPAt352
WcmVt2d09thyeS5nwn/K5Qf6brZz2fN6SWrBxwocMmgRKm5/eZv9yHztfon5mCIa
7cyXzTy7VyADUJiGiqu8/kfiYJQbtfKzwXCq5S/0p6grnfmvJamcAE+DW+mOcbzl
q45a7D0vKLUpN4J7s6eE8qL1Bj5Jun0j3MgU3KWjt2UOngnxFcLoeCZNa3z4vg+x
1q/r2UVL0QIDAQABoz8wPTAdBgNVHQ4EFgQUPFS7uhcOC2xvS38ufE5h8mgsZcgw
DwYDVR0TBAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGB
AAR7Tb+J+uDcJhtKG/vr/mfOdtyQgnojcofHYyk/gFonU5fvjLzKAx0jEnzy1dAr
r6TRUftxzPKk4e40p9aK4qZh7mihZynqnE7fKOl9qBdoa3OywZsHtdEFWwQMofcg
DiLOHKXREDgEQx0Dd4FIHJXVLVopGQa58kJdHtOAljkT4DeZKVoYZ6mir3vYr4PO
fHnUwjoj4i7uGyBmtkaDP4kqNAIVU6hZlU8txvLcEwH0Gr3vyZ9GH0j6t5qpRFRK
iT3D2CStrVjYaqls99C/lle8+81iKBinhCc1Q2rbjFX29v+BDSViDTzLPiuwZ0+3
sAgtgG+i6/IugOPhWUUR6HCn2bYyFqqfB3+PseU59IHEGn8iDzgxZ1Q2IPCUNfY+
jTJN/osiYFOst9a9jLHrwrVuflcq55FLt29qeeJfCAdHSFsSF+pQutKexIsoSlak
QEO6HAc961RZvkR2n1UaFSppR7H9wtN2f/bXhlWR3s4wjd+BPqK/q2Vk1r0Mkg4s
XQ==
-----END CERTIFICATE-----`,
    },
});

module.exports = pool;
